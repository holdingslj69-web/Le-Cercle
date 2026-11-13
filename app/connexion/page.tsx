import { signIn, verifyCode } from "./actions";

type SP = { envoye?: string; erreur?: string; suite?: string; email?: string };

export default function Connexion({ searchParams }: { searchParams: SP }) {
  const suite = searchParams.suite ?? "/catalogue";
  return (
    <>
      <h1>Connexion</h1>
      {searchParams.erreur && <div className="notice">{searchParams.erreur}</div>}
      {searchParams.envoye ? (
        <>
          <div className="notice ok">E-mail envoyé{searchParams.email ? ` à ${searchParams.email}` : ""}. Touchez le lien qu&apos;il contient, ou entrez ci-dessous le code à 6 chiffres.</div>
          <form action={verifyCode} className="group">
            <input type="hidden" name="email" value={searchParams.email ?? ""} />
            <input type="hidden" name="suite" value={suite} />
            <div className="field"><label htmlFor="code">Code reçu par e-mail</label>
              <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,8}" required placeholder="123456" /></div>
            <button className="btn primary" type="submit">Me connecter</button>
          </form>
          <a className="btn quiet" href={`/connexion?suite=${encodeURIComponent(suite)}`}>Changer d&apos;adresse ou renvoyer un e-mail</a>
        </>
      ) : (
        <form action={signIn} className="group">
          <p className="muted">Entrez votre adresse e-mail professionnelle : vous recevez un lien et un code de connexion, sans mot de passe.</p>
          <input type="hidden" name="suite" value={suite} />
          <div className="field"><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" required autoComplete="email" defaultValue={searchParams.email} /></div>
          <button className="btn primary" type="submit">Recevoir mon lien</button>
        </form>
      )}
    </>
  );
}
