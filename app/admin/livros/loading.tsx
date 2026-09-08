// Esqueleto da lista enquanto a planilha é lida (critério 8.2: estado de
// carregamento em vez de tela em branco).
export default function CarregandoListaDeLivros() {
  return (
    <>
      <div className="mb-[26px] h-[52px]" />
      <div className="overflow-hidden rounded-[14px] border border-hairline bg-superficie">
        {[0, 1, 2, 3].map((linha) => (
          <div
            key={linha}
            className="flex items-center gap-4 border-b border-preenchimento-fraco px-[18px] py-4 last:border-b-0"
          >
            <div className="h-[52px] w-[38px] rounded-[5px] bg-preenchimento" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-[11px] w-2/5 rounded-full bg-preenchimento" />
              <div className="h-[9px] w-1/4 rounded-full bg-preenchimento-fraco" />
            </div>
            <div className="h-5 w-[78px] rounded-full bg-preenchimento" />
            <div className="h-[11px] w-[92px] rounded-full bg-preenchimento-fraco" />
          </div>
        ))}
      </div>
    </>
  )
}
