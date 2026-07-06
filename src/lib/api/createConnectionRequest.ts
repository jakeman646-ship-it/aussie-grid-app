/**
 * Aussie Grid — Connection request API (legacy export)
 * File: src/lib/api/createConnectionRequest.ts
 * Version: v0.1.2.17
 *
 * @deprecated Use submitConnectionRequest from ./submitConnectionRequest instead.
 */
export {
  submitConnectionRequest as createConnectionRequest,
  resolveHouseholdId,
  mapConnectionSubmitError,
  verifySupabaseReachable,
  type SubmitConnectionRequestInput as CreateConnectionRequestParams,
  type SubmitConnectionRequestResult,
  type InverterMake,
} from "./submitConnectionRequest";
