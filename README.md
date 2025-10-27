# site-pernambuco-iii

Site estático (HTML + CSS + JavaScript + Plotly) para visualizar a temperatura dos **23 motores** da Pernambuco III, com:
- filtros de **data/hora**;
- seleção de **motores** (UG#01 … UG#23);
- linha pontilhada **vermelha** em **50 °C** com tooltip *“Temp. mínima para partida”*;
- **cards** por motor (imagem verde/vermelho, tempo de disponibilidade e economia/consumo);
- **cálculo dinâmico** de economia/consumo com base nos parâmetros **Preço (R$)** e **Consumo (L/h)**;
- layout responsivo, estilo **Flutter-like**.

## Como publicar no GitHub Pages

1. Crie um repositório (ex.: `site-pernambuco-iii`) e envie **todos os arquivos** desta pasta para a **raiz** do repositório.
2. No GitHub, acesse **Settings → Pages** e selecione a branch (ex.: `main`) e a pasta **/ (root)**. Salve.
3. Aguarde alguns instantes e acesse a URL do GitHub Pages exibida.

> Dica: ao **atualizar os CSV** (`grupo_1.CSV`, `grupo_2.CSV`, `grupo_3.CSV`, `grupo_4.CSV`), basta fazer commit/push; o site recarrega esses arquivos no `fetch()` automaticamente.

## Estrutura dos CSV

- **Coluna A:** data no formato `MM/DD/YY`  
- **Coluna B:** hora no formato `HH:MM:SS`  
- **Colunas C…:** temperaturas por motor. Os cabeçalhos têm o formato `SCAxxxTE402PV`.  
  - O **número do motor** é inferido pelos **dois primeiros dígitos** após `SCA`.  
  - Exemplos: `SCA011TE402PV → Motor 01`, `SCA231TE402PV → Motor 23`.

## Regras de cálculo

- **Disponibilidade:** soma do tempo com **T > 50 °C** (formato `hh:mm h`).  
- **Aquecimento elétrico (UG#05, UG#06, UG#11, UG#12, UG#17, UG#18, UG#19, UG#20):**
  - **Economia diesel (L):** horas com **T > 40 °C** × **Consumo (L/h)**.  
  - **Economia diesel (R$):** resultado anterior × **Preço (R$)**.  
  - Ativa a partir das datas:  
    - UG#05: 24/10/2025 16:10  
    - UG#11: 25/10/2025 10:52  
    - UG#17: 23/10/2025 12:00  
    - Demais: desde o início dos dados.
- **Demais motores:** exibem **Consumo de diesel (L)** calculado como horas com **T > 34 °C** × **Consumo (L/h)**.

## Parâmetros (editáveis na interface)

- **Preço do litro diesel (R$)** – padrão **5,34**  
- **Consumo de aquecimento (L/h)** – padrão **6,30**

## Observações

- O gráfico usa **Plotly** com `hovertemplate` para exibir **UG#XX**, **temperatura (1 casa decimal)** e **hora/minuto**.  
- O **eixo Y** é fixo de **20 a 80 °C**.  
- A **linha vermelha** de 50 °C aparece como *trace* com estilo pontilhado e exibe tooltip *“Temp. mínima para partida”*.  
- A lista de motores (pílulas) permite **ativar/desativar** cada série; as cores são **consistentes** no gráfico e nos cards.
