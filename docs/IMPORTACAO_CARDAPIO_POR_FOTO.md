# Importação de cardápio por foto

## Objetivo

Permitir que o estabelecimento envie uma foto de um cardápio e revise os produtos reconhecidos antes de cadastrá-los no MercadoFood.

## Fluxo

1. Em **Produtos**, selecionar **Importar foto**.
2. Enviar uma imagem JPG, PNG ou WEBP com até 8 MB.
3. A API autenticada envia a imagem à OpenAI e recebe categoria, nome, descrição, preço e nível de confiança.
4. O usuário revisa, edita, seleciona ou remove itens.
5. Somente após a confirmação os produtos são gravados.
6. Produtos importados entram pausados. A ativação continua sendo uma decisão do estabelecimento.

## Segurança e multiempresa

- A rota exige usuário autenticado, acesso ao módulo de produtos e plano compatível.
- `company_id` é obtido no servidor pela sessão; nunca vem do navegador.
- `OPENAI_API_KEY` é usada somente no servidor e não possui o prefixo público do Next.js.
- A imagem é validada por tipo e tamanho e não é armazenada pelo MercadoFood.
- A solicitação à OpenAI usa `store: false`.
- Produtos com o mesmo nome e categoria já cadastrados são ignorados.

## Variáveis de ambiente

- `OPENAI_API_KEY`: chave privada da API OpenAI.
- `OPENAI_MENU_IMPORT_MODEL`: modelo com entrada de imagem e saída estruturada. O padrão atual é `gpt-5.6-luna`.

## Rollback

Não há migration de banco. Para desativar o recurso, reverta os arquivos da rota, do modal e a inclusão do botão em Produtos. Produtos já confirmados permanecem no banco como registros normais e pausados.
