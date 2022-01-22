import { LitElement, html, css } from "lit";

export class courseInfoStudent extends LitElement {

    static styles = css`
    .course-table-section {
        padding-left: 3rem;
        padding-right: 3rem;
    }
    
    .scroll-table {
        overflow:auto;
        overflow-y: scroll;
        height: 60vh;
    }
    
    thead {
        top: 0;
        z-index: 2;
        position: sticky;
     }
    
    .styled-table {
        align-self:flex-start;
        border-collapse: collapse;
        margin: 25px 0;
        font-size: 0.9em;
        font-family: sans-serif;
        min-width: 400px;
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

    .modal {
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
    
      #modal-content {
        background-color: #fefefe;
        margin: auto;
        padding: 20px;
        border: 1px solid #888;
        width: 80%;
        border-radius: 10px;
        animation: appear 201ms ease-in 1;
    
      }
    
      #text-div{
        column-count: 2;
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
        <div class="course-table-section">
            <course-modal-student></course-modal-student>
            <course-table></course-table>
        </div>
        `;
    }
}

customElements.define('course-info-student', courseInfoStudent);