import { Router } from 'express';
import { z } from 'zod';
import { authenticate, currentUser, requireRole } from '../middleware/auth.js';
import { MAX_LINE_QUANTITY } from '../models/Cart.js';
import {
  addCartItem,
  getCartView,
  removeCartItem,
  setCartItemQuantity,
} from '../services/cart.service.js';
import { objectIdString, parseId } from '../utils/validation.js';

const quantity = z.number().int().min(1).max(MAX_LINE_QUANTITY);
const addItemSchema = z.object({ productId: objectIdString, quantity: quantity.default(1) });
const updateItemSchema = z.object({ quantity });

export const cartRouter = Router();

// Every cart is resolved from the session, so one customer cannot reach another's.
cartRouter.use(authenticate, requireRole('CUSTOMER'));

cartRouter.get('/', async (req, res) => {
  res.json({ cart: await getCartView(currentUser(req)._id) });
});

cartRouter.post('/items', async (req, res) => {
  const customerId = currentUser(req)._id;
  const input = addItemSchema.parse(req.body);
  await addCartItem(customerId, parseId(input.productId, 'product id'), input.quantity);
  res.status(201).json({ cart: await getCartView(customerId) });
});

cartRouter.patch('/items/:productId', async (req, res) => {
  const customerId = currentUser(req)._id;
  const productId = parseId(req.params.productId, 'product id');
  await setCartItemQuantity(customerId, productId, updateItemSchema.parse(req.body).quantity);
  res.json({ cart: await getCartView(customerId) });
});

cartRouter.delete('/items/:productId', async (req, res) => {
  const customerId = currentUser(req)._id;
  await removeCartItem(customerId, parseId(req.params.productId, 'product id'));
  res.json({ cart: await getCartView(customerId) });
});
