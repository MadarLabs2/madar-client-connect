import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { AllowedTable } from "@/lib/project-db.server";
import {
  bakeryOrdersList,
  projectCount,
  projectDelete,
  projectInsert,
  projectList,
  projectUpdate,
  projectUploadImage,
  projectSafeDeleteStorageFiles,
} from "@/lib/project-db.functions";

type EqValue = string | number | boolean | null;

type SelectOptions = {
  head?: boolean;
  count?: "exact";
};

class BakerySelectQuery<T = unknown>
  implements PromiseLike<{ data: T[] | null; count: number | null; error: Error | null }>
{
  private selectColumns = "*";
  private limitValue = 500;
  private orderColumn?: string;
  private orderAscending = true;
  private readonly eqFilters: Record<string, EqValue> = {};

  constructor(
    private readonly projectId: string,
    private readonly table: AllowedTable,
    private readonly listFn: ReturnType<typeof useServerFn<typeof projectList>>,
    private readonly countFn: ReturnType<typeof useServerFn<typeof projectCount>>,
    private readonly options?: SelectOptions,
  ) {}

  select(columns = "*") {
    this.selectColumns = columns;
    return this;
  }

  limit(limit: number) {
    this.limitValue = limit;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  eq(column: string, value: EqValue) {
    this.eqFilters[column] = value;
    return this;
  }

  async execute() {
    if (this.options?.head && this.options.count === "exact") {
      const res = await this.countFn({
        data: { projectId: this.projectId, table: this.table, eq: this.eqFilters },
      });
      return { data: null, count: res.count, error: res.error ? new Error(res.error) : null };
    }
    const res = await this.listFn({
      data: {
        projectId: this.projectId,
        table: this.table,
        select: this.selectColumns,
        limit: this.limitValue,
        orderColumn: this.orderColumn,
        orderAscending: this.orderAscending,
        eq: this.eqFilters,
      },
    });
    return { data: (res.rows ?? []) as T[], count: null, error: res.error ? new Error(res.error) : null };
  }

  then<TResult1 = { data: T[] | null; count: number | null; error: Error | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: T[] | null; count: number | null; error: Error | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function useBakeryDb(projectId: string) {
  const listFn = useServerFn(projectList);
  const countFn = useServerFn(projectCount);
  const insertFn = useServerFn(projectInsert);
  const updateFn = useServerFn(projectUpdate);
  const deleteFn = useServerFn(projectDelete);
  const uploadFn = useServerFn(projectUploadImage);
  const deleteStorageFn = useServerFn(projectSafeDeleteStorageFiles);
  const bakeryOrdersFn = useServerFn(bakeryOrdersList);

  return useMemo(
    () => ({
      from<T = unknown>(table: AllowedTable) {
        return {
          select(columns = "*", options?: SelectOptions) {
            return new BakerySelectQuery<T>(projectId, table, listFn, countFn, options).select(columns);
          },
          async insert(row: Record<string, unknown>) {
            await insertFn({ data: { projectId, table, row } });
            return { error: null };
          },
          update(row: Record<string, unknown>) {
            return {
              async eq(column: string, value: string | number) {
                if (column !== "id") throw new Error("Only eq('id', value) is supported for update()");
                await updateFn({ data: { projectId, table, id: value, row } });
                return { error: null };
              },
            };
          },
          delete() {
            return {
              async eq(column: string, value: string | number) {
                if (column !== "id") throw new Error("Only eq('id', value) is supported for delete()");
                await deleteFn({ data: { projectId, table, id: value } });
                return { error: null };
              },
            };
          },
        };
      },
      async bakeryOrders(options?: {
        limit?: number;
        orderColumn?: string;
        orderAscending?: boolean;
        eq?: Record<string, EqValue>;
      }) {
        const res = await bakeryOrdersFn({
          data: {
            projectId,
            limit: options?.limit,
            orderColumn: options?.orderColumn,
            orderAscending: options?.orderAscending,
            eq: options?.eq,
          },
        });
        return { data: res.rows ?? [], error: res.error ? new Error(res.error) : null };
      },
      async uploadImage(file: File, options?: { bucket?: string; folder?: string }) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const chunkSize = 0x8000;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
        }
        const res = await uploadFn({
          data: {
            projectId,
            fileName: file.name,
            contentType: file.type || "image/jpeg",
            dataBase64: btoa(binary),
            bucket: options?.bucket,
            folder: options?.folder,
          },
        });
        return { data: res, error: null };
      },
      async safeDeleteStorageFiles(
        urls: string[],
        opts?: { excludeProductId?: string; excludeCategoryId?: string },
      ) {
        await deleteStorageFn({
          data: {
            projectId,
            urls,
            excludeProductId: opts?.excludeProductId,
            excludeCategoryId: opts?.excludeCategoryId,
          },
        });
      },
    }),
    [
      projectId,
      listFn,
      countFn,
      insertFn,
      updateFn,
      deleteFn,
      uploadFn,
      deleteStorageFn,
      bakeryOrdersFn,
    ],
  );
}
