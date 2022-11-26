# RAPSXLoader

Script Node.js para automatizar o Download dos jogos de Playstation 1 compatíveis com conquistas no Retroachievements.

## Melhorias

O projeto é inicial e funcional; mas as seguintes melhorias estão sendo focadas:

- [x] Fazer o download da ISO do jogo vindo do archive.org
- [x] Criar filtros que permitam fazer o "match" entre jogo e conquista de pelo menos 50% da lista de jogos com conquista
- [x] Fazer o download das coleções do archive.org que tenham várias páginas, permitindo a leitura de ISO de diferentes regiões
- [ ] Criar uma interface gráfica
- [ ] Parametrizar o projeto para fazer o match de mais consoles

## Pré-requisitos

Antes de começar, verifique se você atendeu aos seguintes requisitos:
* Instalar a versão mais atual do NodeJS;
* Executar ```npm install --global``` na raíz do projeto;

## Executando

Para executar o projeto, execute o seguinte comando na diretório raiz do projeto:
```npm start```


## Como funciona

O script vai fazer o download dos arquivos na raíz do diretório.
É útil em cenários onde você quer criar um disco bootável, pois basta mover o script para o diretório alvo, executar o ```npm install --global``` e o ```npm start```, e ao final da execução, o script irá deletar o diretório ```node_modules```.

## Aspectos legais

É de inteira responsabilidade sua baixar e executar o script. Apenas o implementei com a finalidade de exercitar os meus conhecimentos os relacionando com o meu hobby. Manter ISOs e executar jogos os quais você não possui pode implicar em sansões legais.