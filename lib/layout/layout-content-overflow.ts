export function shouldContainLayoutContent(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  return segments[1] === "forms" && Boolean(segments[2])
}
