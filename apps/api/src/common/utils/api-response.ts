export interface ApiResponse<T> {
  success: true;
  message: string;
  data: T;
}

export function apiResponse<T>(
  data: T,
  message = 'Request successful',
): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}
