export function httpError(status, message, fields, code) {
  return Object.assign(new Error(message), { status, fields, code });
}

export function validate(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw httpError(
      422,
      "Please check the highlighted fields.",
      result.error.flatten().fieldErrors,
    );
  }
  return result.data;
}
