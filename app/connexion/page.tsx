import { signIn } from "./actions";

export default function Connexion({ searchParams }: { searchParams: { envoye?: string; erreur?: string; suite?: string } }) {
  return (
    <>
      <h1>Connexion</h1>
      {searchParams.envoye ? (
        <div className="notice ok">Un lien de connexion vient de vous être envoyé par e-mail. Ouvrez-le sur cet appareil.</div>
      ) : (
        <form action={signIn} className="group">
          <p className="muted">Entrez votre adresse e-mail professionnelle : vous recevez un lien de connexion, sans mot de passe.</p>
          <input type="hidden" name="suite" value={searchParams.suite ?? "/catalogue"} />
          <div className="field"><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
          {searchParams.erreur && <div className="notice">{searchParams.erreur}</div>}
          <button className="btn primary" type="submit">Recevoir mon lien</button>
        </form>
      )}
    </>
  );
}
