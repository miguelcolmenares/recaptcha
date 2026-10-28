// A page without a reCAPTCHA field: visiting it must release the script.
export default function PlainPage() {
  return <main data-testid="plain">No form here</main>;
}
