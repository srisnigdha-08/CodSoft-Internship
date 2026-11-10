import type { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export const sendOk = <T>(res: Response, data: T) => res.json({ success: true, data });

export const sendCreated = <T>(res: Response, data: T) =>
  res.status(201).json({ success: true, data });

export const sendPage = <T>(res: Response, page: Paginated<T>) =>
  res.json({ success: true, data: page.items, meta: page.meta });

export const sendMessage = (res: Response, message: string) => res.json({ success: true, message });

export const pageArgs = (page: number, limit: number) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const pageMeta = (total: number, page: number, limit: number): PageMeta => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});
