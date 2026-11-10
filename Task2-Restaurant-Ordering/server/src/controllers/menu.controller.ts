import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MenuCategory, MenuItem, Order } from '../models';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { sendCreated, sendSuccess } from '../utils/response';
import { runAtomic } from '../db';
import { containsInsensitive, idOrField, objectIdSchema } from '../utils/ids';

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
  categoryId: objectIdSchema('Invalid Category ID'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug is required'),
  description: z.string().min(5, 'Description must be at least 5 characters'),
  price: z.number().positive('Price must be greater than zero').max(100000, 'Price is too high'),
  // An absolute URL, or a path to an image shipped with the frontend (e.g. /images/dish.svg)
  imageUrl: z
    .string()
    .refine((value) => z.string().url().safeParse(value).success || /^\/(?!\/)[\w./-]+$/.test(value), 'Invalid image URL'),
  isVegetarian: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  preparationTimeMinutes: z.number().int().min(1).max(480).default(15),
  sortOrder: z.number().int().default(0),
});

const updateMenuItemSchema = createMenuItemSchema.partial();

async function assertCategoryExists(categoryId?: string) {
  if (categoryId && !(await MenuCategory.exists({ _id: categoryId }))) {
    throw new BadRequestError('A referenced record does not exist.');
  }
}

/** Past orders keep their name and price snapshot and simply lose the link to the deleted dish. */
async function deleteMenuItems(itemIds: unknown[], session?: Parameters<Parameters<typeof runAtomic>[0]>[0]) {
  await Order.updateMany(
    { 'items.menuItemId': { $in: itemIds } },
    { $set: { 'items.$[line].menuItemId': null } },
    { arrayFilters: [{ 'line.menuItemId': { $in: itemIds } }], session }
  );
  await MenuItem.deleteMany({ _id: { $in: itemIds } }, { session });
}

// Category Controllers
export async function getCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const [categories, counts] = await Promise.all([
      MenuCategory.find().sort({ sortOrder: 1 }),
      MenuItem.aggregate<{ _id: unknown; items: number }>([{ $group: { _id: '$categoryId', items: { $sum: 1 } } }]),
    ]);

    const itemCounts = new Map(counts.map((c) => [String(c._id), c.items]));

    return sendSuccess(res, {
      categories: categories.map((category) => ({
        ...category.toJSON(),
        _count: { items: itemCounts.get(category.id) || 0 },
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = createCategorySchema.parse(req.body);

    const category = await MenuCategory.create(validated);

    return sendCreated(res, { category }, 'Category created successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const validated = updateCategorySchema.parse(req.body);

    const category = await MenuCategory.findByIdAndUpdate(id, validated, { new: true, runValidators: true });
    if (!category) {
      throw new NotFoundError('The requested record was not found.');
    }

    return sendSuccess(res, { category }, 'Category updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const category = await MenuCategory.findById(id);
    if (!category) {
      throw new NotFoundError('The requested record was not found.');
    }

    // Deleting a category also deletes its dishes
    const items = await MenuItem.find({ categoryId: category._id }).select('_id');
    await runAtomic(async (session) => {
      await deleteMenuItems(items.map((item) => item._id), session);
      await MenuCategory.deleteOne({ _id: category._id }, { session });
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

    const where: Record<string, unknown> = {};

    if (category) {
      const matched = await MenuCategory.findOne({ slug: String(category) }).select('_id');
      if (!matched) {
        return sendSuccess(res, { items: [] });
      }
      where.categoryId = matched._id;
    }

    if (search) {
      const term = containsInsensitive(String(search).trim());
      where.$or = [{ name: term }, { description: term }];
    }

    if (vegetarian !== undefined) {
      where.isVegetarian = vegetarian === 'true';
    }

    if (available !== undefined) {
      where.isAvailable = available === 'true';
    }

    const items = await MenuItem.find(where)
      .sort({ sortOrder: 1, name: 1 })
      .populate({ path: 'category', select: 'name slug' });

    return sendSuccess(res, { items });
  } catch (err) {
    next(err);
  }
}

export async function getMenuItemById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const item = await MenuItem.findOne(idOrField(id, 'slug')).populate('category');

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
    await assertCategoryExists(validated.categoryId);

    const created = await MenuItem.create(validated);
    const item = await created.populate('category');

    return sendCreated(res, { item }, 'Menu item created successfully');
  } catch (err) {
    next(err);
  }
}

export async function updateMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const validated = updateMenuItemSchema.parse(req.body);
    await assertCategoryExists(validated.categoryId);

    const item = await MenuItem.findByIdAndUpdate(id, validated, { new: true, runValidators: true }).populate('category');
    if (!item) {
      throw new NotFoundError('The requested record was not found.');
    }

    return sendSuccess(res, { item }, 'Menu item updated successfully');
  } catch (err) {
    next(err);
  }
}

export async function deleteMenuItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const item = await MenuItem.findById(id);
    if (!item) {
      throw new NotFoundError('The requested record was not found.');
    }

    await runAtomic((session) => deleteMenuItems([item._id], session));

    return sendSuccess(res, null, 'Menu item deleted successfully');
  } catch (err) {
    next(err);
  }
}
