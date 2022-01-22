import { LitElement, html, css } from 'lit';
import { Course } from '../../model/course';
import { CourseService } from '../../service/CourseService';

export class ShowTableData extends LitElement {
    static styles = css`
    `;

    constructor() {
        super();
        this.courseService = new CourseService();
    }

    render() {
        return html`
            
    `;
    }

    showData(list) {
        let table = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('course-info').shadowRoot.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0);
        let tbd = table.tBodies.item(0);
        tbd.innerHTML="";
        for (let conversion of list) {
            let tr = document.createElement('tr');
                for (let i = 0; i < 7; i++) {
                    let td = document.createElement('td');
                    td.innerText = Object.values(conversion[i]);
                    tr.appendChild(td);
                }
                tbd.appendChild(tr);
                table.appendChild(tbd);
        }
        console.log(list);
    }



}

customElements.define('show-table', ShowTableData);
