export function consPath(conventionId: number) {
  return `/cons?id=${conventionId}`;
}

export function consEditionPath(conventionId: number, editionId: number) {
  return `${consPath(conventionId)}#edition-${editionId}`;
}
