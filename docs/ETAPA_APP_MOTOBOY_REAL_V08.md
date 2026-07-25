# MercadoFood v0.8 — Aplicativo real do motoboy

## Entregas desta etapa
- E-mail obrigatório no cadastro do motoboy.
- Ativação da conta pelo próprio entregador.
- Login com Supabase Auth.
- Vínculo automático entre o usuário e o cadastro criado pela loja.
- Disponível/offline no aplicativo.
- GPS real pelo navegador do celular.
- Corrida real carregada do Supabase.
- Aceitar ou recusar corrida.
- A caminho da loja, chegada, retirada, em entrega e conclusão.
- Atualização do pedido e liberação automática do motoboy.
- Políticas RLS para restringir o motoboy aos próprios dados.

## Teste recomendado
1. Execute todas as migrations no Supabase.
2. Cadastre um motoboy no painel usando um e-mail ainda não usado.
3. No celular, abra `/entregador/cadastro` e crie a conta com o mesmo e-mail.
4. Entre em `/entregador/login`.
5. Marque-se disponível.
6. Na loja, atribua um pedido pronto ao motoboy.
7. No app, aceite e avance até concluir.

## Atenção
Para o GPS funcionar, o navegador precisa permitir localização e o site deve estar em HTTPS ou localhost.
