import { LitElement, html, css } from "lit";

export class infoModal extends LitElement {
    static styles = css`
        .info-button {
            border: none;
            border-radius: 145px;
            cursor: pointer;
            outline: none;
            background-color: whitesmoke;
            max-width: fit-content;
        }
        #modal {
            display: none; 
            position: fixed; 
            z-index: 3; 

            padding-top: 100px; 
            left: 0;
            top: 0;
            width: 100%; 
            height: 100%; 
            overflow: auto; 
            background-color: rgb(0,0,0); 
            background-color: rgba(0,0,0,0.4); 
        }
        
        .modal-content {
            background-color: #fefefe;
            margin: auto;
            padding: 20px;
            border: 1px solid #888;
            width: 55%;
            border-radius: 10px;
            animation: appear 201ms ease-in 1;
        }
        .close:hover,
        .close:focus {
            color: #000;
            text-decoration: none;
            cursor: pointer;
        }
        .close {
            width: 30px;
            font-size: 20px;
            color: #c0c5cb;
            align-self: flex-end;
            background-color: transparent;
            border: none;
            margin-bottom: 10px;
            float: right;
        }

        @keyframes appear {
            0%{
                opacity: 0;
                transform: translateY(-10px);
            }
        }
    `;

    constructor() {
        super();           
    }

    render() {
        return html`
        <section id = "modal-section" @click="${this._closeModalOutside}">
            <input type="image" class="info-button" id="info-button" @click="${this._twoFunctions}" src="./src/images/question-mark.png" alt="info knop" width="45px" height="25px">     
            <div id="modal" role="alertdialog">
                <div class="modal-content" role="alertdialog">
                    
                    <div class="modal-body" role="alertdialog">

                        <button class="close" aria-labelledby="escape knop" id="close-button" @click="${this._hideModal}">✖</button>

                        <h1 tabindex="0" >Stappenplan voor het importeren van een excel bestand</h1>
                        <p tabindex="0">
                        <span >&#8226;</span> Klik op de Choose File knop <br>
                        <span>&#8226;</span> Selecteer het excel bestand dat je wilt importeren <br>
                        <span>&#8226;</span> Klik op de "kiess een tablad" knop <br>
                        <span>&#8226;</span> Selecteer het tablad wat je in wilt laden op de pagina <br>
                        </p>
                        <h2 tabindex="0" >Navigatie door de tabel</h2>
                        <p tabindex="0">
                        In de tabel zie je een overzicht van alle cursussen die een vervangend vak hebben. <br>
                        per cursus krijg je de volgende eigenschappen te zien: Opleiding, Oude naam, Nieuwe naam, Oude Code, Nieuwe code, Periode, Bezem/conversie.
                        in de laatste kolom is te zien of het vak volgens de bezem of conversie regeling gaat. <br>
                        Door in de zoekbalk een oude code van een cursus in te voeren krijg je de informatie van vakken met een overeenkomende oude code. 
                        Door op een cursus in de tabel te klikken krijg je een gedetaileerd overzicht van de geselecteerde cursus. 
                        <p>
                        <h3 tabindex="0" >Informatie over bezem/conversie regeling</h3>
                        <p tabindex="0">
                        Bezem: Er wordt geen les meer gegeven voor de cursus maar er is nog een laatste kans om het examen te maken.
                        <br>
                        Conversie: De cursus wordt niet langer meer gegeven en wordt vervangen door een ander vak.
                        </p>
                    </div>
                </div>
            </div>
            </section>
            
        `;
    }

    _twoFunctions() {
        this._focusAccessable();
        this._showModal();
    }

    _focusAccessable() {
        const focusableElements = 'button, h1, span, h2, h3, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const modal = this.shadowRoot.querySelector('#modal');

        const firstFocusableElement = this.shadowRoot.querySelector('button');
        const focusableContent = modal.querySelectorAll(focusableElements);
        const lastFocusableElement = focusableContent[focusableContent.length - 1]; 

        let shadow = this.shadowRoot;

        document.addEventListener('keydown', function(e) {
            let isTabPressed = e.key === 'Tab' || e.keyCode === 9;

            if (!isTabPressed) {
                return;
            }

            if (e.shiftKey ) { 
                if (shadow.activeElement === firstFocusableElement) {
                    lastFocusableElement.focus();
                    e.preventDefault();
                }
            } else { 
                if (shadow.activeElement === lastFocusableElement) { 
                    firstFocusableElement.focus();
                    e.preventDefault();
                }
            }
        });
    }

    _showModal() {
        let modalDiv = this.shadowRoot.querySelector('#modal')
        modalDiv.style.display = 'block';
    }

    _hideModal() {
        let modalDiv = this.shadowRoot.querySelector('#modal')
        modalDiv.style.display = 'none';
    }

    _closeModalOutside(event) {
        let modalDiv = this.shadowRoot.querySelector('#modal')
        if (event.target == modalDiv) {
            modalDiv.style.display = "none";
        }
    }
}

customElements.define('info-modal', infoModal);





