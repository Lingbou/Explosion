export function cleanVolumeName(filename: string, bookName?: string): string {
  let name = filename.replace(/\.txt$/i, '').trim()
  if (bookName) {
    const cleanB = bookName.replace(/[《》]/g, '').trim()
    const patterns = [
      new RegExp(`^《?${cleanB}》?[_\\s-]+`, 'i'),
      new RegExp(`^《?${bookName}》?[_\\s-]+`, 'i')
    ]
    for (const pat of patterns) {
      name = name.replace(pat, '')
    }
  }
  return name.trim() || filename.replace(/\.txt$/i, '')
}
