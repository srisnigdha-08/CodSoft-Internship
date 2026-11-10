export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: FieldError[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string) => new ApiError(400, message);
export const unauthorized = (message = 'Authentication required') => new ApiError(401, message);
export const forbidden = (message = 'You do not have permission to perform this action') =>
  new ApiError(403, message);
export const notFound = (message = 'Resource not found') => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);
export const unprocessable = (message: string, errors?: FieldError[]) =>
  new ApiError(422, message, errors);
