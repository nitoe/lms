export default function KelasPlaceholder() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-muh-900">Ruang kelas</h1>
      <p className="text-sm text-muted">
        Halaman ini akan menampilkan daftar kelas/mapel yang diampu guru (dari data penugasan Penilaian)
        dan ruang kelas per mapel. Implementasi penuh di Fase 1.
      </p>
      <div className="card-soft p-6 text-center text-sm text-muted">
        Belum ada data kelas untuk ditampilkan. Setelah Fase 1, daftar kelas akan muncul di sini.
      </div>
    </div>
  )
}
