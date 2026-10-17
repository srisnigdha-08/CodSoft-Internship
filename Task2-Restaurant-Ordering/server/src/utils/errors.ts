export class ApiError extends Error {
  public statusCode: number;
  public details?: any;

  constructor(statusCode: number, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Bad Request', details?: any) {
    super(400, message, details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', details?: any) {
    super(401, message, details);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden - Insufficient permissions', details?: any) {
    super(403, message, details);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', details?: any) {
    super(404, message, details);
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Conflict with existing resource', details?: any) {
    super(409, message, details);
  }
}
