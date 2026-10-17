import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { sendCreated, sendSuccess } from '../utils/response';

// Validation Schemas
const createCategorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug is required'),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const updateCategorySchema = createCategorySchema.partial();

const createMenuItemSchema = z.object({
  categoryId: z.string().uuid('Invalid Category ID'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug is required'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  price: z.number().positive('Price must be greater than zero'),
  imageUrl: z.string().url('Invalid image URL'),
  isVegetarian: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  preparationTimeMinutes: z.number().int().min(1).default(15),
  sortOrder: z.number().int().default(0),
});

const updateMenuItemSchema = createMenuItemSchema.partial();

// Category Controllers
export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await prisma.menuCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return sendSuccess(res, { categories });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = createCategorySchema.parse(req.body);

    const category = await prisma.menuCategory.create({
      data: validated,
    });

    return sendCreated(res, { category }, 'Category created successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const validated = updateCategorySchema.parse(req.body);

    const category = await prisma.menuCategory.update({
      where: { id },
      data: validated,
    });

    return sendSuccess(res, { category }, 'Category updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await prisma.menuCategory.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Category deleted successfully');
  } catch (err) {
    next(err);
  }
}

// Menu Items Controllers
export async function getMenuItems(req: Request, res: Response, next: NextFunction) {
  try {
    const { category, search, vegetarian, available } = req.query;

    const where: any = {};

    if (category) {
      where.category = {
        slug: String(category),
      };
    }

    if (search) {
      const term = String(search).trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (vegetarian !== undefined) {
      where.isVegetarian = vegetarian === 'true';
    }

    if (available !== undefined) {
      where.isAvailable = available === 'true';
    }

    const items = await prisma.menuItem.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return sendSuccess(res, { items });
  } catch (err) {
    next(err);
  }
}

export async function getMenuItemById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const item = await prisma.menuItem.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        category: true,
      },
    });

    if (!item) {
      throw new NotFoundError('Menu item not found');
    }

    return sendSuccess(res, { item });
  } catch (err) {
    next(err);
  }
}

export async function createMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = createMenuItemSchema.parse(req.body);

    const item = await prisma.menuItem.create({
      data: validated,
      include: {
        category: true,
      },
    });

    return sendCreated(res, { item }, 'Menu item created successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const validated = updateMenuItemSchema.parse(req.body);

    const item = await prisma.menuItem.update({
      where: { id },
      data: validated,
      include: {
        category: true,
      },
    });

    return sendSuccess(res, { item }, 'Menu item updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    await prisma.menuItem.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Menu item deleted successfully');
  } catch (err) {
    next(err);
  }
}
