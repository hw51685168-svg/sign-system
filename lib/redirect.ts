export function appRedirect(path: string) {
  const targetPath = path.startsWith("/") ? path : `/${path}`;

  return new Response(null, {
    status: 303,
    headers: {
      Location: targetPath
    }
  });
}
