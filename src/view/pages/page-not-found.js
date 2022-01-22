import { LitElement, html, css } from 'lit';

export class PageNotFound extends LitElement {
  static styles=css``;
  static properties = {};

  constructor() {
    super();
  }

  render() {
    return html`
      <h1>OEPS...</h1>
      <p>De pagina die je zocht kon niet gevonden worden</p>
    `;
  }
}

customElements.define('page-not-found', PageNotFound);
