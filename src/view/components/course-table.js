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

export class Coursetable extends LitElement {
    static styles = css`

    .course-table-section {
        padding-left: 3rem;
        padding-right: 3rem;
    }

    a:link {
        text-decoration: none;
    }
    
    .scroll-table {
        overflow:auto;
        overflow-y: scroll;
        height: 60vh;
        overflow-x: scroll; 
    }
    
    thead {
        top: 0;
        z-index: 2;
        position: sticky;
    }

    thead th {
        cursor: pointer;
        -webkit-touch-callout: none;
        -webkit-user-select: none;
        -khtml-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
    }

    thead th:active {
        opacity: 0.6;
    }
    thead th:hover {
        background-color:#0489ba;
    }

    .styled-table tr:hover td,
    .styled-table tr:active td{
        background-color:#d9d9d9;
    }
    
    .styled-table {
        table-layout="fixed";
        align-self:flex-start;
        border-collapse: collapse;
        margin: 25px 0;
        font-size: 0.9em;
        font-family: sans-serif;
        width: 100%;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
        margin-top: 0rem;
    }
    
    .styled-table thead tr {
        background-color: #009ad1;
        color: #ffffff;
        text-align: left;
    }
    
    
    .styled-table th,
    .styled-table td {
        padding: 12px 15px;
    }
    
    .styled-table tbody tr {
        border-bottom: 1px solid #dddddd;
    }
    
    .styled-table tbody tr:nth-of-type(even) {
        background-color: #f3f3f3;
    }
    
    .styled-table tbody tr:last-of-type {
        border-bottom: 2px solid #009ad1;
    }
      
    .styled-table .th-sort-asc::after {
        content: "▲";
    }
      
    .styled-table .th-sort-desc::after {
        content: "▼";
    }
      
    .styled-table .th-sort-asc::after,
    .styled-table .th-sort-desc::after {
        margin-left: 15px;
    }
      
    .styled-table .th-sort-asc,
    .styled-table .th-sort-desc {
        background: rgba(0, 0, 0, 0.1);
    }


    @media (max-width: 1200px) {

        .scroll-table { 
            width: 1100px !important;
        }
    
        th, td {min-width: 200px; }
    }

    @media (max-width: 1100px) {

        .scroll-table { 
            width: 1000px !important;
        }
    
        th, td {min-width: 200px; }
    }

    @media (max-width: 1000px) {

        .scroll-table { 
            width: 900px !important;
        }
    
        th, td {min-width: 200px; }
    }

    @media (max-width: 900px) {

        .scroll-table { 
            width: 800px !important;
        }
    
        th, td {min-width: 200px; }
    }

    @media (max-width: 800px) {

        .scroll-table { 
            width: 700px !important;
        }
    
        th, td {min-width: 200px; }
    }

    @media (max-width: 700px) {

        .scroll-table { 
            width: 600px !important;
        }
    
        th, td {min-width: 200px; }
    }

    @media (max-width: 500px) {

        .scroll-table { 
            width: 480px !important;
        }
    
        th, td {min-width: 200px; }
    }
    `;

    constructor() {
        super();
        this.StorageService = new StorageService();
        this.currentTableInfo = ""; //test for ruben.
    }

    render() {
        return html`
            <div id="course-table-id" class="scroll-table">
                <table class="styled-table" id="t">

                    <caption hidden>Cursussen met een bezem/conversie regeling</caption>

                    <thead>
                        <tr>
                            <th tabindex="0 scope="col">Oude code</th>
                            <th tabindex="0 scope="col">Opleiding</th>
                            <th tabindex="0 scope="col">Oude naam</th>
                            <th tabindex="0 scope="col">Conversie/Bezem</th>
                            <th tabindex="0 scope="col">Nieuwe code</th>
                            <th tabindex="0 scope="col">Nieuwe naam</th>
                            <th tabindex="0 scope="col">Periode</th>
                        </tr>
                    </thead>
                    <tbody></body>
                </table>
            </div>
        `;
    }

  sortTableByColumn(table, column, asc = true) {
        const dirModifier = asc ? 1 : -1;
        const tBody = table.tBodies[0];
        const rows = Array.from(tBody.querySelectorAll("tr"));

        const sortedRows = rows.sort((a, b) => {
            const aColText = a.querySelector(`td:nth-child(${ column + 1 })`).textContent.trim();
            const bColText = b.querySelector(`td:nth-child(${ column + 1 })`).textContent.trim();

            return aColText > bColText ? (1 * dirModifier) : (-1 * dirModifier);
        });

        while (tBody.firstChild) {
            tBody.removeChild(tBody.firstChild);
        }

        tBody.append(...sortedRows);
        table.querySelectorAll("th").forEach(th => th.classList.remove("th-sort-asc", "th-sort-desc"));
        table.querySelector(`th:nth-child(${ column + 1})`).classList.toggle("th-sort-asc", asc);
        table.querySelector(`th:nth-child(${ column + 1})`).classList.toggle("th-sort-desc", !asc);
    }

    addSortFunction() {

        let shadowTable = null
        if (document.querySelector('student-page') === null) {
            shadowTable = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('course-info-cursus').shadowRoot;
        } else {
            shadowTable = document.querySelector('student-page').shadowRoot.querySelector('course-info-student').shadowRoot;
        }
        let table = shadowTable.querySelector('course-table').shadowRoot;

        table.querySelectorAll(".styled-table th").forEach(headerCell => {
            headerCell.addEventListener("click", () => {
                const tableElement = headerCell.parentElement.parentElement.parentElement;
                const headerIndex = Array.prototype.indexOf.call(headerCell.parentElement.children, headerCell);
                const currentIsAscending = headerCell.classList.contains("th-sort-asc");
                this.sortTableByColumn(tableElement, headerIndex, !currentIsAscending);
            });
        });
    }

    deleteAscDescFromTableHeaders() {
        let shadowdomTable = this.shadowRoot.querySelector('thead tr');
        shadowdomTable.querySelectorAll("th").forEach(th => th.classList.remove("th-sort-asc", "th-sort-desc"));
      }


    updated() {
        /* Two list for accessing the data from the sheet. */
        var listSheetNames = ['1-Propedeuse BM-U', '2- Prop BKMER', '3-Prop BDK U', '4-Hoofdfase BM-U', '5-Hoofdfase BKMER', '6-Hoofdfase BDK U', '7-Minor ', '8- Conversie over opleidingen ', '9-Geen studenten meer']
        let KeyListOfConversions = ['9/6/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];


        var listRowObjects2 = this.StorageService.getStorage();

        /* if statement so the page will get the right elements */
        let shadowPage = null
        if (document.querySelector('student-page') === null) {
            shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
        } else {
            shadowPage = document.querySelector('student-page').shadowRoot;
        }

        let selectElement = shadowPage.querySelector('table-nav').shadowRoot.querySelector('dropdown-tabblad');
        /* fill the combobox in the component */
        if (listRowObjects2 != null){
            listRowObjects2.pop()
            selectElement.fillComboBox(shadowPage, listRowObjects2, listSheetNames, KeyListOfConversions, false);
        }

        this.generateTableSheet("Alle tabladen", listRowObjects2, KeyListOfConversions);
      }


    /* generate the storage for the objects in the local Storage. */
    generateStorage(listrowObject, KeyListOfConversions){
        window.localStorage.setItem('exams', "[]");
        window.localStorage.setItem('courses', "[]");
        window.localStorage.setItem('conversions', "[]");
        let tblBody2 = document.createElement("tbody");
        let tblHead2 = document.createElement("thead");
        KeyListOfConversions = ['9/6/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];
        generateTableSheet1(listrowObject[0], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet2(listrowObject[1], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet3(listrowObject[2], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet4(listrowObject[3], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet5(listrowObject[4], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet6and8(listrowObject[5], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet7(listrowObject[6], KeyListOfConversions, tblBody2, tblHead2, true);
        KeyListOfConversions = ['6/18/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];
        generateTableSheet6and8(listrowObject[7], KeyListOfConversions, tblBody2, tblHead2, true);
        generateTableSheet9(listrowObject[8], KeyListOfConversions, tblBody2, tblHead2, true);
    }

    generateTableSheet(sheet, listrowObject, KeyListOfConversions){
        let shadowPage = null
        if (document.querySelector('student-page') === null) {
            shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
        } else {
            shadowPage = document.querySelector('student-page').shadowRoot;
        }

       /* if statement so the page will get the right table info element*/
       let shadowTableInfo = null
       if (shadowPage.querySelector('course-info-student') === null) {
           shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
       } else {
           shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
       }

        // /* delete the previous contents of the table, so it is empty. */
        let tbl = shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0);
        tbl.tBodies.item(0).innerHTML = "";

        /* get the table element. */
        tbl = shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0);
        tbl.id = sheet;
        /* get the body of the table. this is where the content of the table should be. */
        let tblBody = tbl.tBodies.item(0);
        /* get the header of the table. */
        let tblHead = tbl.tHead;

        if (sheet === '1-Propedeuse BM-U'){
            generateTableSheet1(listrowObject[0], KeyListOfConversions, tblBody, tblHead, false);
            this.currentTableInfo = listrowObject[0];
        }
        else if (sheet === "2- Prop BKMER"){
            generateTableSheet2(listrowObject[1], KeyListOfConversions, tblBody, tblHead, false);
        }
        else if (sheet === "3-Prop BDK U"){
            generateTableSheet3(listrowObject[2], KeyListOfConversions, tblBody, tblHead, false);
        }
        else if (sheet === '4-Hoofdfase BM-U'){
            generateTableSheet4(listrowObject[3], KeyListOfConversions, tblBody, tblHead, false);
        }
        else if (sheet === '5-Hoofdfase BKMER'){
            generateTableSheet5(listrowObject[4], KeyListOfConversions, tblBody, tblHead, false);
        }
        else if (sheet === '6-Hoofdfase BDK U'){
            generateTableSheet6and8(listrowObject[5], KeyListOfConversions, tblBody, tblHead, false);
        }
        else if (sheet === '7-Minor '){
            generateTableSheet7(listrowObject[6], KeyListOfConversions, tblBody, tblHead, false);
        }
        KeyListOfConversions = ['6/18/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];
        if (sheet === '8- Conversie over opleidingen '){
            generateTableSheet6and8(listrowObject[7], KeyListOfConversions, tblBody, tblHead, false);
        }
        else if (sheet === '9-Geen studenten meer'){
            generateTableSheet9(listrowObject[8], KeyListOfConversions, tblBody, tblHead, false);
        }

        else if (sheet === 'Alle tabladen'){
            if (this.StorageService.getStorage() != null){
                KeyListOfConversions = ['9/6/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];
                generateTableSheet2(listrowObject[1], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet3(listrowObject[2], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet4(listrowObject[3], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet5(listrowObject[4], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet6and8(listrowObject[5], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet7(listrowObject[6], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet1(listrowObject[0], KeyListOfConversions, tblBody, tblHead, false);
                KeyListOfConversions = ['6/18/21', 'Versie update', '__EMPTY', '__EMPTY_1', '__EMPTY_2', '__EMPTY_3', '__EMPTY_4', '__EMPTY_5', '__EMPTY_6', '__EMPTY_7', '__EMPTY_8', '__EMPTY_9', '__EMPTY_10', '__EMPTY_11', '__EMPTY_12', '__EMPTY_13', '__EMPTY_14'];
                generateTableSheet6and8(listrowObject[7], KeyListOfConversions, tblBody, tblHead, false);
                generateTableSheet9(listrowObject[8], KeyListOfConversions, tblBody, tblHead, false);
            }
        }
    }

    searchOpenModel(list){
            let shadowTable = null
            if (document.querySelector('student-page') === null) {
                shadowTable = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('course-info-cursus').shadowRoot.querySelector('course-modal-cursus').shadowRoot;
            } else {
                shadowTable = document.querySelector('student-page').shadowRoot.querySelector('course-info-student').shadowRoot.querySelector('course-modal-student').shadowRoot;
            }
            let modalDiv = shadowTable.querySelector('#myModal');
            let divModalContent = shadowTable.querySelector('#modal-content');
            let textDiv = shadowTable.querySelector('#text-div');
            modalDiv.classList.add("showModal");
            list.forEach((element) => {
                let inputField = document.createElement('input');
                let label = document.createElement('label');
                let editDiv = document.createElement('div')
                inputField.className="inputField";
                label.htmlFor="inputField"
                editDiv.className="editDiv"
                label.innerHTML = Object.keys(element) + ": ";
                inputField.value = Object.values(element);
                editDiv.appendChild(label)
                editDiv.appendChild(inputField);
                textDiv.appendChild(editDiv)
            });
            divModalContent.appendChild(textDiv)
            modalDiv.style.display = "block";
    }

    showSearchData(list) {
        // let filterValue = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('table-nav').shadowRoot.querySelector('filter-courses').shadowRoot.querySelector('select').value;

        /* if statement so the page will get the right element*/
        let shadowPage = null
        let shadowTableInfo = null
        if (document.querySelector('student-page') == null) {
            shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
            shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
        } else {
            shadowPage = document.querySelector('student-page').shadowRoot;
            shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
        }
        
        let table = shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0);
        let tbd = table.tBodies.item(0);
        tbd.innerHTML="";
        for (let conversion of list) {
            let tr = document.createElement('tr');
            for (let i = 0; i < 7; i++) {
                let td = document.createElement('td');
                if (i === 4){
                    let cellText = document.createElement("a");  
                    cellText.innerHTML=
                    `<a class="external" href=https://hu.osiris-student.nl/#/inschrijven/cursus/:id target=_blank>${Object.values(conversion[i])}</a>`;
                    td.appendChild(cellText);
                }else{
                    td.innerText = Object.values(conversion[i]);
                }
                tr.appendChild(td);
            }
            let element = shadowTableInfo.querySelector('course-table');
            tr.addEventListener("click", () =>
                element.searchOpenModel(conversion));
            tr.tabIndex= 0;
            tbd.appendChild(tr);
            table.appendChild(tbd);
        }
    }

}

customElements.define('course-table', Coursetable);
