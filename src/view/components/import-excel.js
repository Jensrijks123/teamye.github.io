import { LitElement, html, css } from "lit";
import { generateTableSheet1 } from "../../excelSheetFunctions/sheet1";
import { generateTableSheet2 } from "../../excelSheetFunctions/sheet2";
import { generateTableSheet3 } from "../../excelSheetFunctions/sheet3";
import { generateTableSheet4 } from "../../excelSheetFunctions/sheet4";
import { generateTableSheet5 } from "../../excelSheetFunctions/sheet5";
import { generateTableSheet6and8 } from "../../excelSheetFunctions/sheet6and8";
import { generateTableSheet7 } from "../../excelSheetFunctions/sheet7";
import { generateTableSheet9 } from "../../excelSheetFunctions/sheet9";
import { StorageService } from "../../service/StorageService";

 
export class importExcel extends LitElement {

    static styles = css`
        .button-label {
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

        .button-label:hover, .export-button:hover {
            background: rgb(145 145 145);
        }
        
        .button-label:active, .export-button:active {
            transform: scale(.98);
        }

        #modal-load {
            display: none; 
            position: absolute; 
            z-index: 3; 
            overflow: auto; 
            left: 50%;
            bottom: 65px;
            transform: translate(-50%, -50%);
            margin: 0 auto;

        
            background: #E0EAFC;  
            background: -webkit-linear-gradient(to right, #CFDEF3, #E0EAFC);  
            background: linear-gradient(to right, #CFDEF3, #E0EAFC); 

            width: 250px;
            height:60px;
            animation: appear 201ms ease-in 1;
            margin: auto;
            padding: 5px;
            border-radius: .25em .25em .4em .4em;
            box-shadow: rgb(38, 57, 77) 0px 20px 30px -10px;
            text-align: center;
            font-size:1.5em;
        }

        @keyframes appear {
            0%{
                opacity: 0;
                transform: translateY(-10px);
            }
        }

        .button__text {
            color:#2e2e2e;
            font-size: 1.1rem;
            transition: all 0.2s;
        }

        .button__text__fout {
            color:#2e2e2e;
            font-size: 1.1rem;
            transition: all 0.2s;
        }

        
        .button--loading .button__text {
            visibility: hidden;
        }

        .button--loading::after {
            content: "";
            position: absolute;
            width: 32px;
            height: 32px;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            margin: auto;
            border: 4px solid transparent;
            border-top-color: black;
            border-radius: 50%;
            animation: button-loading-spinner 1s ease infinite;
        }
      
        @keyframes button-loading-spinner {
            from {
            transform: rotate(0turn);
            }
        }
        
        @keyframes button-loading-spinner {
            from {
                transform: rotate(0turn);
            }
        
            to {
                transform: rotate(1turn);
            }
        }  
    `;

    constructor() {
        super();
        this.StorageService = new StorageService();
    }


    render() {
        return html`
            <div tabindex="0" .onkeyup=${(e) => this.keyUpHandler(e)}>
                <input class="import-button" id="input" type="file" accept=".xls,.xlsx" @change="${this.triggerImportButton}"  hidden>      
                <label for="input" class="button-label">Bestand Kiezen</label>  
            </div>

            <div class="modal-load" id="modal-load" role="alertdialog">
                <p class="button__text"></p>
                <p class="button__text__fout"></p>
            </div>

            `;
    }


    showLoadingModal() {
        let modalDivLoad = this.shadowRoot.querySelector('#modal-load')
        modalDivLoad.style.display = 'block';
        modalDivLoad.classList.toggle('button--loading');
    }

    hideLoadingModal() {
        let modalDivLoad = this.shadowRoot.querySelector('#modal-load')
        modalDivLoad.style.display = 'none';
    }

    
    popupConfirmation() {
        let modalDivLoad = this.shadowRoot.querySelector('#modal-load')
        let shadowdom = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('table-nav').shadowRoot.querySelector('dropdown-tabblad').shadowRoot.querySelector('select');
        let importText = modalDivLoad.querySelector('.button__text');
        modalDivLoad.classList.remove('button--loading');
        importText.innerHTML = "Bestand is  geïmporteerd";
        shadowdom.className += " pulse"


        setTimeout(function(){
            modalDivLoad.style.display = 'none';
            shadowdom.classList.remove("pulse")
            importText.innerHTML = "";
        },5700);
    }

    alertPopup() {
        let modalDivLoad = this.shadowRoot.querySelector('#modal-load')
        modalDivLoad.classList.remove('button--loading');
        let textModalLast = modalDivLoad.querySelector('.button__text__fout');
        textModalLast.innerHTML = "Geen geldig bestand!"
        setTimeout(function(){
            modalDivLoad.style.display = 'none';
            textModalLast.innerHTML = ""
        },4700);
    }


    keyUpHandler(e) {       
        if (e.key === 'Enter') {
            this.shadowRoot.querySelector('#input').click();
        }
    }

    triggerImportButton(event){
        let selectedFile = event.target.files[0];
        
        if (selectedFile) {
            // Call the load modal
            this.showLoadingModal();

            let fileReader = new FileReader();
   
            fileReader.readAsBinaryString(selectedFile);
            fileReader.onload = (event)=> {

    
                let binaryData = event.target.result;
            
                let workbook = XLSX.read(binaryData, {type: "binary"});
                    
                let listSheetNames = workbook.SheetNames;
                listSheetNames.shift();
                let listRowObjects = [];
  
                workbook.SheetNames.forEach(sheet => {
                    if (sheet != "overzichtspagina"){
                        listRowObjects.push(XLSX.utils.sheet_to_json(workbook.Sheets[sheet]));
                    }
                });

                if(listRowObjects.length !== 0 && Object.values(listRowObjects[0][0])[0] === "Bezem & Conversie Propedeuse BM Utrecht studiejaar 2021-2022") {
                    
                    this.StorageService.saveDatabase(listRowObjects);
                    
                    let KeyListOfConversions = ['9/6/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];
                    
                    let shadowPage = null
                    let shadowTableInfo = null
                    if (document.querySelector('student-page') === null) {
                        shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
                        shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
                    } else {
                        shadowPage = document.querySelector('student-page').shadowRoot;
                        shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
                    }

    
                    let selectElement = shadowPage.querySelector('table-nav').shadowRoot.querySelector('dropdown-tabblad');  
                    /* fill the combobox in the component */
                    selectElement.fillComboBox(shadowPage, listRowObjects, listSheetNames, KeyListOfConversions, true);


                    /* show confirmation modal */ 
                    this.popupConfirmation();
                    let tableElement = shadowTableInfo.querySelector('course-table');
                    tableElement.generateTableSheet("Alle tabladen", listRowObjects, KeyListOfConversions);
                    this.StorageService.addExtraSheet();
                } else {
                    this.alertPopup();
                }
            }
        }
    }
}

customElements.define('import-excel', importExcel);