import { LitElement, html, css } from "lit";

export class exportImportWorker extends LitElement {
 
    static styles = css`
    #course-table-export-import-id {
        margin-top: 1.5rem;
        margin-right: 2rem;
        margin-bottom: 1.5rem;
        padding-left: 3rem;
        padding-right: 3rem;
        display: flex;
        align-items: center;
        justify-content: right;
    }    

    .left{
        margin-right:auto;
    }

    `;

    constructor() {
        super();
    }

    render() {
        return html`
            <div id="course-table-export-import-id">
                <div id="info" class="left">
                    <crud-koppeling></crud-koppeling>   
                </div>
                <import-excel></import-excel>
                <export-button></export-button>
            </div>
        `;
    }
}

customElements.define('export-import-worker', exportImportWorker);