import { Router } from 'express';
import { z } from 'zod';
import { Ingredient } from '../models/Ingredient.js';
import { HttpError, idParam, parse } from '../utils/http.js';
export const ingredientsRouter = Router();
const toJson = (i) => ({ id: String(i._id), name: i.name, unit: i.unit });
const fields = z.object({
    name: z.string().trim().min(1, 'Name is required').max(60),
    unit: z.string().trim().min(1, 'Unit is required').max(20),
});
ingredientsRouter.get('/', async (_req, res) => {
    const items = await Ingredient.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
    res.json(items.map(toJson));
});
ingredientsRouter.post('/', async (req, res) => {
    const body = parse(fields, req.body);
    const last = await Ingredient.findOne().sort({ sortOrder: -1 }).lean();
    const item = await Ingredient.create({ ...body, sortOrder: (last?.sortOrder ?? 0) + 1 });
    res.status(201).json(toJson(item));
});
ingredientsRouter.patch('/:id', async (req, res) => {
    const body = parse(fields.partial(), req.body);
    const item = await Ingredient.findByIdAndUpdate(idParam(req), body, { new: true, runValidators: true });
    if (!item)
        throw new HttpError(404, 'Item not found');
    res.json(toJson(item));
});
// Past purchases keep the item name as text, so removing an item from the list loses nothing.
ingredientsRouter.delete('/:id', async (req, res) => {
    const item = await Ingredient.findByIdAndDelete(idParam(req));
    if (!item)
        throw new HttpError(404, 'Item not found');
    res.status(204).end();
});
//# sourceMappingURL=ingredients.js.map