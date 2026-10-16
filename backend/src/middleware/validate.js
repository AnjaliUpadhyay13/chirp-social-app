// validate(schema, 'body' | 'query' | 'params') -> replaces the source with the parsed (cleaned) data.
// ZodError is turned into a 400 VALIDATION_ERROR by the central error handler.
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(result.error);
  req[source] = result.data;
  next();
};
