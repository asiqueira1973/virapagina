// Esqueleto da lista enquanto o Firestore é lido (critério 8.2: estado de
// carregamento em vez de tela em branco).
export default function CarregandoMeusLivros() {
  return (
    <>
      <div className="mb-[26px] h-[52px]" />
      <div className="overflow-hidden rounded-[14px] border border-traco bg-superficie">
        {[0, 1, 2, 3].map((linha) => (
          <div
            key={linha}
            className="flex items-center gap-4 border-b border-traco px-[18px] py-4 last:border-b-0"
          >
            <div className="h-[52px] w-[38px] rounded-[5px] bg-ativo" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-[11px] w-2/5 rounded-full bg-ativo" />
              <div className="h-[9px] w-1/4 rounded-full bg-ativo/60" />
            </div>
            <div className="h-5 w-[78px] rounded-full bg-ativo" />
            <div className="h-[11px] w-[92px] rounded-full bg-ativo/60" />
          </div>
        ))}
      </div>
    </>
  )
}
