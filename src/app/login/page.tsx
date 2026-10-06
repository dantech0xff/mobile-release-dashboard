export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  return (
    <div className="mx-auto mt-24 max-w-sm">
      <LoginForm searchParams={searchParams} />
    </div>
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <form action="/api/auth/login" method="post" className="card space-y-4">
      <h1 className="text-lg font-semibold">Sign in</h1>
      {sp.error && <p className="text-sm text-red-400">Wrong password.</p>}
      <input type="hidden" name="next" value={sp.next || "/"} />
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoFocus required />
      </div>
      <button type="submit" className="btn w-full">
        Sign in
      </button>
    </form>
  );
}
