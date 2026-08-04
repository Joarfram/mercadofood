# MercadoFood — Governança de GPS e planos v2.0

Este documento registra as regras obrigatórias para desenvolver e comercializar
o módulo MercadoFood Entregador sem comprometer a privacidade dos entregadores
nem a margem financeira da plataforma.

## Regra obrigatória de privacidade

O MercadoFood não rastreará o entregador apenas porque ele está disponível.

1. O entregador pode ficar disponível para receber uma oferta sem transmitir GPS.
2. Uma oferta ou corrida aceita ainda não autoriza rastreamento contínuo.
3. O GPS começa somente quando o entregador tocar em **Iniciar corrida**.
4. Cada posição deve estar vinculada a uma corrida ativa, ao entregador e à empresa.
5. O servidor deve rejeitar posições sem corrida ativa ou enviadas por outro entregador.
6. O GPS para imediatamente ao concluir, cancelar, recusar ou expirar a corrida.
7. Uma proteção automática deve encerrar corridas abandonadas após o prazo configurado.
8. Loja e cliente só podem visualizar a localização enquanto a corrida estiver ativa.
9. O aplicativo deve exibir de forma permanente: **Localização sendo compartilhada**.
10. O sistema registra horário de início e término, mas não mantém rastreamento pessoal fora da entrega.

O aplicativo encerra o acesso e o envio de localização pelo MercadoFood; ele não
desliga o GPS geral do aparelho, que pode continuar sendo usado por outros aplicativos.

## Três níveis comerciais de entrega

| Recurso | Básico — Vender | Profissional — Operar | Premium — Crescer |
|---|---|---|---|
| Cadastro do endereço e taxa de entrega | Sim | Sim | Sim |
| Abrir rota no Google Maps por link externo | Sim | Sim | Sim |
| Cadastro de motoboys | — | Até 5 | Até 20 |
| Aplicativo do entregador | — | Sim | Sim |
| Status da corrida | Manual | Em tempo real | Em tempo real |
| Rastreamento GPS para loja e cliente | — | Até 150 corridas/mês | Até 500 corridas/mês |
| Distribuição e acompanhamento | Manual | Painel operacional | Painel avançado |
| Relatório por entregador | — | Resumo | Completo |
| Várias unidades | — | — | Até 3 |

Os limites de 150 e 500 corridas são franquias comerciais iniciais. Eles devem ser
confirmados durante o piloto por meio do custo real por corrida e podem ser ajustados
antes do lançamento definitivo.

## Proteção financeira

- O plano Básico usa um link externo do Google Maps, sem cálculo de rota dentro do sistema.
- O Profissional e o Premium possuem franquia mensal de corridas rastreadas.
- O consumo é contabilizado por empresa, e não apenas pela conta geral do MercadoFood.
- Alertas aparecem ao atingir 70%, 85% e 100% da franquia.
- Ao chegar a 100%, não haverá cobrança surpresa: a empresa poderá comprar um pacote
  adicional ou continuar usando entrega manual e abertura de rota externa.
- Pacote inicial sugerido: mais 100 corridas rastreadas por R$ 19,90. O valor será
  revisado após o piloto e antes da venda pública.
- O Google Cloud deve possuir cotas diárias, alertas de orçamento e chaves restritas
  ao domínio e às APIs realmente utilizadas.
- O sistema deve registrar por empresa: corridas rastreadas, carregamentos do mapa,
  cálculos de rota, tempo de rastreamento e custo técnico estimado.

## Otimização técnica obrigatória

- GPS desligado quando o entregador estiver apenas disponível, offline ou sem corrida.
- Atualização de posição em intervalo controlado, nunca em loop sem limite.
- Intervalo maior quando o entregador estiver parado.
- Somente a última posição necessária fica disponível para acompanhamento público.
- Histórico detalhado possui retenção limitada e é eliminado conforme a política de privacidade.
- O link público deixa de expor a posição assim que a entrega termina.
- Uma corrida não pode ser usada simultaneamente por dois entregadores.

## Diferença definitiva entre os planos

- **Básico — Vender:** cardápio, pedidos e entrega simples, sem custo variável de GPS.
- **Profissional — Operar:** cozinha, caixa, equipe, clientes e operação de entregadores
  com rastreamento limitado. Deve ser o plano mais escolhido.
- **Premium — Crescer:** tudo do Profissional, franquia maior de rastreamento, mais
  entregadores, estoque, ficha técnica, custos, margens, relatórios avançados e até três unidades.

## Critério de implantação

Antes de liberar o rastreamento comercialmente, devem existir testes automatizados e
manuais comprovando que nenhuma localização é aceita antes de **Iniciar corrida** e
que nenhuma localização é aceita depois de concluir ou cancelar a entrega.
