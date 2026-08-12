# Impressoras térmicas — MVP

- Cadastro multiempresa em `/configuracoes/impressoras`.
- USB, rede e Bluetooth; papel de 58 mm e 80 mm.
- Cozinha, balcão, bar e entrega; vias e conteúdo do cupom.
- Editar, pausar, ativar, excluir e imprimir teste pelo navegador.
- Impressão e reimpressão do pedido pelo painel de Pedidos, com itens, complementos, observações, cliente, endereço, valores, pagamento e troco conforme as preferências da impressora.
- RLS: somente proprietário e gerente da empresa.

## Conector Windows

Ao editar uma impressora, o proprietário pode baixar um conector exclusivo. Ele consulta uma fila segura a cada cinco segundos e imprime diretamente pelo nome configurado no Windows.

- Dinheiro e cartão na entrega entram na fila imediatamente.
- PIX e pagamentos online entram somente quando o pedido fica pago.
- A combinação pedido/impressora é única e evita impressão duplicada.
- Falhas voltam para a fila, com no máximo cinco tentativas.
- O token do conector é armazenado apenas como hash no banco.
