# Gestão Delivery Simples

Plano único e paralelo aos planos Básico, Profissional e Premium. É administrado pelo Master do MercadoFood e entrega uma operação enxuta para pequenos negócios de delivery, empórios, frios, produtos naturais, lojas a granel, lanchonetes e similares.

## 1. Fluxo do lojista

1. Criar conta do responsável: nome, e-mail, CPF e celular.
2. Cadastrar loja: nome, endereço e telefone.
3. Definir identidade: logo e nome público do cardápio.
4. Configurar atendimento: entrega, retirada ou ambos.
5. Se houver entrega, cadastrar taxa fixa do motoboy.
6. Configurar horários e meios de pagamento.
7. Cadastrar produtos com prévia em tempo real.
8. Informar estoque inicial e estoque mínimo, quando desejar controle.
9. Publicar cardápio por link/QR Code.

## 2. Cadastro de produto

Campos principais:
- foto;
- nome;
- descrição;
- categoria;
- forma de venda;
- preço;
- estoque e disponibilidade.

### Formas de venda

#### Unidade
Exemplos: garrafa de vinagre, refrigerante, pacote e pote.

#### Por peso
Exemplos: queijo, presunto, castanhas e produtos a granel.

Campos adicionais:
- preço-base;
- quantidade de referência;
- unidade de referência (g ou kg);
- quantidade mínima;
- incremento de venda.

Fórmula:

`valor = quantidade escolhida / quantidade de referência * preço-base`

Exemplos:
- queijo R$ 24,00 / 1 kg: 250 g = R$ 6,00;
- creatina R$ 5,00 / 100 g: 250 g = R$ 12,50.

#### Pesos prontos
Para opções fechadas, como 100 g, 250 g e 500 g.

## 3. Cardápio do cliente

- produto com foto, nome, descrição e preço;
- produto por peso mostra referência, por exemplo `R$ 24,00/kg`;
- cliente escolhe quantidade/peso;
- valor é recalculado em tempo real;
- carrinho permanece visível e permite adicionar mais produtos.

## 4. Checkout

1. Cliente revisa carrinho.
2. Escolhe Retirada ou Entrega.
3. Se escolher Entrega, o MercadoFood soma automaticamente a taxa fixa configurada.
4. Escolhe PIX, cartão ou dinheiro, conforme habilitado pela loja.
5. Finaliza o pedido.

## 5. WhatsApp e pagamento

Ao finalizar, o pedido fica salvo no MercadoFood e a loja recebe mensagem contendo:
- número do pedido;
- cliente e telefone;
- itens, quantidades e pesos;
- subtotal;
- retirada ou entrega;
- endereço, quando houver;
- taxa de entrega;
- total;
- forma de pagamento.

Para PIX, o lojista envia a chave pelo WhatsApp. Para cartão, envia o link de pagamento. O cliente envia o comprovante e o lojista confirma manualmente o pagamento antes de separar/preparar o pedido.

Status sugeridos:
`Aguardando pagamento → Pago → Separando/Em preparo → Pronto → Saiu para entrega/Pronto para retirada → Concluído`.

## 6. Impressão PDV

Configuração opcional de impressão automática para novos pedidos. A comanda deve conter dados do cliente, itens, pesos/quantidades, retirada/entrega, endereço, total, pagamento e observações. Deve existir ação de reimpressão no pedido.

## 7. Estoque integrado

Um único estoque atende delivery e loja física.

- venda pelo MercadoFood baixa estoque automaticamente;
- venda física pode ser registrada por saída rápida;
- entrada de mercadoria soma estoque;
- ajustes manuais exigem motivo;
- cada produto pode ter estoque atual, unidade e estoque mínimo;
- ao atingir o mínimo, gera alerta;
- ao zerar, pode ficar indisponível automaticamente.

Para peso, recomenda-se normalizar internamente para gramas, mesmo quando a interface exibir quilogramas.

## 8. Dashboard

Indicadores principais:
- vendas do dia;
- faturamento do dia;
- pedidos delivery;
- ticket médio;
- produtos vendidos;
- produto mais vendido;
- aguardando pagamento;
- pedidos em andamento;
- estoque baixo;
- sem estoque;
- valor estimado em mercadoria, quando houver custo de entrada.

## 9. Menu lateral da Gestão Delivery Simples

- Início / Dashboard
- Pedidos
- Cardápio
- Estoque
- Clientes
- Entrega
- QR Code
- Configurações

O cliente do plano não vê módulos avançados. Em Configurações > Meu Plano aparece `Gestão Delivery Simples`.

## 10. Master MercadoFood

A Gestão Delivery Simples é um plano único, gerenciado no Master, separado visualmente da linha principal Básico / Profissional / Premium.

O Master controla:
- preço;
- teste;
- ativo/inativo;
- recursos;
- limites;
- clientes do plano;
- vencimentos;
- uso e métricas.

## 11. Melhorias já aprovadas para a primeira versão

- prévia em tempo real no cadastro;
- carrinho persistente;
- reserva temporária de estoque para evitar venda duplicada do último saldo;
- histórico de movimentações;
- ajuste de estoque com motivo;
- indisponibilidade automática quando zerar;
- confirmação manual de pagamento;
- reimpressão em caso de falha;
- pedido mínimo opcional;
- perfis básicos de dono e funcionário;
- exportação básica de pedidos/estoque.

## 12. Fora da primeira versão

- taxa por bairro/faixa;
- pagamento integrado dentro do MercadoFood;
- GPS de motoboy;
- ficha técnica consumindo ingredientes do estoque;
- financeiro avançado;
- multi-loja avançado.

## 13. Ordem de implementação

### Fase 1
- modelo de dados para forma de venda;
- cadastro de produto por unidade/peso/pesos prontos;
- cálculo proporcional;
- prévia do produto.

### Fase 2
- cardápio público e carrinho com peso;
- retirada/entrega;
- taxa fixa;
- checkout e pagamento escolhido.

### Fase 3
- pedido, WhatsApp e impressão PDV;
- status de pagamento e operação.

### Fase 4
- estoque integrado, entradas, saídas, ajustes e mínimos.

### Fase 5
- dashboard, relatórios básicos, clientes e controles do Master.
