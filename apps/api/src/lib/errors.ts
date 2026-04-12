export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const Errors = {
  badRequest: (message: string, code = "BAD_REQUEST") =>
    new ApiError(400, code, message),

  unauthorized: (message: string, code = "UNAUTHORIZED") =>
    new ApiError(401, code, message),

  forbidden: (message: string, code = "FORBIDDEN") =>
    new ApiError(403, code, message),

  notFound: (message: string, code = "NOT_FOUND") =>
    new ApiError(404, code, message),

  conflict: (message: string, code = "CONFLICT") =>
    new ApiError(409, code, message),

  internal: (message: string, code = "INTERNAL_SERVER_ERROR") =>
    new ApiError(500, code, message),
};
