import { LitElement, html, css } from "lit";

export class crudKoppeling extends LitElement {
 
    static styles = css`
        .crudbutton {
            padding: 0.8rem 1.5rem;
            font-weight: bold;
            font-size: 0.9rem;
            color: 0, 0, 0;
            border: none;
            border-radius: 15px;
            outline: none;
            cursor: pointer;
            background: rgb(171 171 171);
        }

        
        .crudbutton:hover {
            background: rgb(145 145 145);
        }
        
        .crudbutton:active {
            transform: scale(.98);
        }
    `;

    constructor() {
        super();
    }

    render() {
        return html` 
            <div tabindex="0">
                <button class="crudbutton" @click="${this.open}">
                    Nieuwe Bezem/Conversie/Cursus/Examen
                </button>   
            </div>
        `;
    }

    open(){
        window.location.href = "http://localhost:8000/crud-page";
    }
}

customElements.define('crud-koppeling', crudKoppeling);