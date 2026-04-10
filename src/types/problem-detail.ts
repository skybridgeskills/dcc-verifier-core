/** RFC 9457-inspired structured error, without `status` (not an HTTP context). */
export interface ProblemDetail {
  /** URI identifying the problem, e.g. "urn:vc-verify:invalid-signature" */
  type: string;
  /** Short human-readable summary, e.g. "Invalid Signature" */
  title: string;
  /** Specific explanation of this occurrence */
  detail: string;
}
