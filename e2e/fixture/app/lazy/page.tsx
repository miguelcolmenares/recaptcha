import { ContactForm } from "../ContactForm";

export default function LazyPage() {
  return (
    <main>
      <div style={{ height: 3000 }}>Scroll down</div>
      <ContactForm lazy />
    </main>
  );
}
