import { LitElement, html, css } from 'lit';

export class crudPage extends LitElement {
  static styles=css``;
  static properties = {};

  constructor() {
    super();
  }

  render() {
    return html`
        <div class="body">
          <nav-barcursus></nav-barcursus>

          <add-conversie-bezem></add-conversie-bezem>

          <footer-component></footer-component>
        </div>
    `;
  }
}

customElements.define('crud-page', crudPage);
