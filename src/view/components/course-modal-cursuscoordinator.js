import { LitElement, html, css } from "lit";

export class CoursemodalCursuscoordinator extends LitElement {
    static styles = css`
    :host{    
      --input-color: #5f6573;
      --input-border: #CDD9ED;
      --input-background: #fff;
      --input-placeholder: #CBD1DC;
  
      --input-border-focus: #275EFE;
  
      --group-color: var(--input-color);
      --group-border: var(--input-border);
      --group-background: #EEF4FF;
  
      --group-color-focus: #fff;
      --group-border-focus: var(--input-border-focus);
      --group-background-focus: #678EFE;
    }

    html {
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
  }
  
  * {
      box-sizing: inherit;
      *:before,
      *:after {
          box-sizing: inherit;
      }
  }

    .modal {
        font-family: 'Mukta Malar', Arial;
        display: none;
        position: fixed;
        z-index: 3;
        padding-top:20px;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgb(0,0,0);
        background-color: rgba(0,0,0,0.4);
      }

      label{
        width:55%;
      }
  
      #modal-content {
        background-color: #fefefe;
        margin: auto;
        padding: 20px;
        border: 1px solid #888;
        min-width: 360px;
        width:600px;
        border-radius: 10px;
        animation: appear 201ms ease-in 1;  
        display:flex;
        flex-direction: column;
      }

      .inputField{
        width: 100%;
        padding: 8px 16px;
        line-height: 25px;
        font-size: 14px;
        font-weight: 500;
        font-family: inherit;
        -webkit-appearance: none;
        color: rgba(0, 0, 0, 0.55);
        border: 1px solid var(--input-border);
        background: var(--input-background);
        transition: border .3s ease;
      }

      .inputField::placeholder {
        color: var(--input-placeholder);
      }

      .inputField:focus {
        outline: none;
        border-color: var(--input-border-focus);
      }

    .editDiv{
      position: relative;
      display: flex;
      margin-left:10px;
      margin-right:10px;
    }

    .editDiv > .inputfield,
    label {
      display: inline-block;
      white-space: nowrap;
      .editDiv > label,
    }


    .inputfield {
        position: relative;
        z-index: 1;
        flex: 1 1 auto;
        width: 1%;
        margin-top: 0;
        margin-bottom: 0;
    }
    
    .editDiv > label {
        text-align: left;
        padding: 8px 12px;
        font-size: 16px;
        line-height: 25px;
        color: var(--group-color);
        background: var(--group-background);
        border: 1px solid var(--group-border);
        transition: background .3s ease, border .3s ease, color .3s ease;
    }


    .editDiv:focus-within > label {
        color: var(--group-color-focus);
        background: var(--group-background-focus);
        border-color: var(--group-border-focus);
      }

  
    .header1{
      margin-top:-5px;
      text-align:center;

      color: #111; 
      font-family: 'Helvetica Neue', sans-serif; font-size: 45px; 
      font-weight: bold; 
      letter-spacing: -1px; 
      line-height: 1; 
      text-align: center;
    }

    #text-div{
      display: inline-block;
      width: 100%;
    }

    .close {
      width: 30px;
      font-size: 20px;
      color: #c0c5cb;
      align-self: flex-end;
      background-color: transparent;
      border: none;
      float: right;
  }
    
    .close:hover,
    .close:focus {
      color: #000;
      text-decoration: none;
      cursor: pointer;
    }

    .buttons {
      margin-top:20px;
      order: 3;
      display: flex;
      justify-content: space-between;
    }

    .cancel {
      order: 4;
      margin-left: 6px;
    }

    .save{
      order: 4;
      margin-right: 14px;
    }

    .button {
      cursor:pointer;
      color:black;
      font-size: 16px;
      display:inline-block;
      border-radius: .4em;
      background: #caedfc;
      border-color:#8fdaff;
    }

    .primary {
      line-height:40px;
      transition:ease-in-out .2s;
      padding: 0 16px;
    }

    .primary:hover{
      box-shadow:2px 2px 5px rgba(0,0,0,0.20), inset 0 0 0 99999px rgba(0,0,0,0.2);
    }

    @keyframes appear {
        0%{
          opacity: 0;
          transform: translateY(-10px);
        }
      }

      .scroll-modal::-webkit-scrollbar-track {
        -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
        background-color: #F5F5F5;
        border-radius: 10px;
      }
      
      .scroll-modal::-webkit-scrollbar {
        width: 10px;
        opacity:0;
      }
      
      .scroll-modal::-webkit-scrollbar-thumb {
        border-radius: 10px;
        background-color: #9bb3bd;
      }
      

      @media (max-height: 900px) {

        .scroll-modal { 
          overflow:auto;
          overflow-y: scroll;
          scrollbar-width: thin;
          scrollbar-color: #999 #333;
          height: 700px !important;
        }
    }

    @media (max-height: 750px) {

      .scroll-modal { 
        height: 600px !important;
      }
    }
      @media (max-height: 650px) {

        .scroll-modal { 
          height: 450px !important;
        }
    }

    @media (max-height: 500px) {

      .scroll-modal { 
        height: 350px !important;
      }
  }

  @media (max-height: 400px) {

    .scroll-modal { 
      height: 250px !important;
    }

    `;

  constructor() {
      super();
  }


  render() {
    return html`
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
      
        <div tabindex="1" role="alertdialog" aria-labelledby="cursus details" id="myModal" class="modal" @click="${this._closeModalOutside}">            
            <div id="modal-content" role="alertdialog" class="scroll-modal">
                <button tabindex="0" class="close" aria-labelledby="escape knop" id="close-button" @click="${this._hideModal}">✖</button>
                <h1 autofocus tabindex="0" class="header1" id="header1">Cursus Overzicht</h1>     
                <div id="text-div"></div>
                <div class="buttons"> 
                  <button  class="cancel button primary" id="cancel-button" @click="${this._cancel}">Annuleren  <i class="fa fa-ban"></i> </button>
                  <button class="save button primary" id="save-button" @click="${this._saveChanges}">Opslaan <i class="fa fa-save"></i></button>
                </div>
            </div>         
        </div>    
    `;
  }   



_focusAccessable() {
    let shadow = this.shadowRoot;
    const modal = shadow.querySelector('#myModal');
    const firstFocusableElement = shadow.querySelector('button');
    const header = modal.querySelector('.header1')
    const lastFocusableElement = modal.querySelector('.save');
    const annuleren = modal.querySelector('.cancel');
    const inputDiv = modal.querySelector('#text-div').querySelector('.editDiv');
    const lastInput = modal.querySelector('#text-div').lastChild;
    const firstInput = modal.querySelector('#text-div').firstChild;

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
            if(shadow.activeElement === annuleren) {
              lastInput.focus();
              e.preventDefault();
            }
            if(shadow.activeElement === firstInput) {
              header.focus();
              e.preventDefault();
            }
        } else { 
            if(shadow.activeElement === header) {
              inputDiv.focus();
              e.preventDefault();
            }
            if(shadow.activeElement === lastInput) {
              annuleren.focus();
              e.preventDefault();
            }
            if (shadow.activeElement === lastFocusableElement) { 
                firstFocusableElement.focus();
                e.preventDefault();
            }
        }
    });
}

  
  _closeModalOutside(event) {
    let shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
    var shadowTable = shadowPage.querySelector('course-info-cursus').shadowRoot;  
    var textDiv = shadowTable.querySelector('course-modal-cursus').shadowRoot.querySelector('#text-div');  
    var modalDiv = this.shadowRoot.querySelector('#myModal')
    if (event.target == modalDiv) {
        modalDiv.style.display = "none";
        textDiv.innerHTML = "";
    }
  }

  _hideModal() {
    let shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
    var shadowTable = shadowPage.querySelector('course-info-cursus').shadowRoot;  
    var textDiv = shadowTable.querySelector('course-modal-cursus').shadowRoot.querySelector('#text-div');  
    var modalDiv = this.shadowRoot.querySelector('#myModal')
    modalDiv.style.display = "none";
    textDiv.innerHTML = "";
}

  _saveChanges(){
    this._hideModal();
  }

  _cancel() {
    this._hideModal();
  }

  createAndOpenModal(listOfAttributes, listOfElements, KeyListOfConversions){
    let shadowTable = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('course-info-cursus').shadowRoot;
    let modalDiv = shadowTable.querySelector('course-modal-cursus').shadowRoot.querySelector('#myModal');
    let divModalContent = shadowTable.querySelector('course-modal-cursus').shadowRoot.querySelector('#modal-content');
    let textDiv = shadowTable.querySelector('course-modal-cursus').shadowRoot.querySelector('#text-div');
    modalDiv.classList.add("showModal");

    listOfAttributes.forEach((element, index) => {
        let inputField = document.createElement('input');
        let label = document.createElement('label');
        let editDiv = document.createElement('div')
        
        inputField.className="inputField";
        label.htmlFor="inputField"
        editDiv.className="editDiv"
        if (element == null || element == "" || element == "Opmerkingen" || element == "Opmerking"){
            element = "-";
        }
        if (listOfElements[KeyListOfConversions[index]] == null){
            listOfElements[KeyListOfConversions[index]] = "Opmerkingen";
        }
        label.innerHTML = listOfElements[KeyListOfConversions[index]] + ": "
        inputField.value = element;
        editDiv.tabIndex = 0;
        editDiv.appendChild(label)
        editDiv.appendChild(inputField);
        textDiv.appendChild(editDiv)
        
    });
    this._focusAccessable();
    divModalContent.appendChild(textDiv);
    modalDiv.style.display = "block";
    modalDiv.focus();
   
}
}

customElements.define('course-modal-cursus', CoursemodalCursuscoordinator);