import { LitElement, html, css } from 'lit';

export class cursuscoordinatorPage extends LitElement {
  static styles = css`
    .body{
      min-height: 100vh;
      margin: 0;
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      font: 500 1rem 'Roboto', sans-serif;
      background-color: whitesmoke;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      -khtml-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
  `;
  static properties = {};

  constructor() {
    super();
  }

  render() {
    return html`
      <div class="body">
        <nav-barcursus></nav-barcursus>

        <table-nav></table-nav>

        <course-info-cursus></course-info-cursus>

        <export-import-worker></export-import-worker>

        <footer-component></footer-component>
      </div>
    `;
  }
}

customElements.define('cursuscoordinator-page', cursuscoordinatorPage);
