export const HttpMethod = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
} as const;

export type HttpMethodValues = (typeof HttpMethod)[keyof typeof HttpMethod];

export const HttpHeaders = {
  REQUEST_ID: 'x-request-id',
} as const;

export type HttpHeadersValues = (typeof HttpHeaders)[keyof typeof HttpHeaders];
