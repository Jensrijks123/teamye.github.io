import { LitElement, html, css } from "lit";

export class tablenav extends LitElement {

    static styles = css`
        .table-nav {
            padding-left: 3rem;
            padding-right: 3rem;
            margin-top: 4rem;
            margin-bottom: 0.5rem;

            display: flex;
            flex-flow: row wrap;
            justify-content:flex-end;
            gap: 10px;
        }
        
        
        #info {
            height: fit-content;
            width: fit-content;
        }

        .search {
            flex-grow: 1;
            margin-right: auto;
        }
        
        
        #filter {
            padding-right: 3px;
        }
        
        
        #search {
            width:fit-content;
        }
        
        #search-id {
            border-color: gainsboro;
        }

        .left{
            margin-right:auto;
        }

        @media all and (max-width: 900px) {
            .table-nav {
                flex-direction: column;
            }
        }

        @media all and (max-width: 800px) {
            .table-nav {
                flex-direction: column;
            }
        }

    `;

    constructor() {
        super();
    }

    render() {
        return html`
        <div class="table-nav">
        
            <div id="info" class="left">
                <info-modal></info-modal>
            </div>

            <div id="search"  class="search left">
                <find-course></find-course>
            </div>            

            <filter-courses class="filterClass right"></filter-courses>
            
            <dropdown-tabblad class="dropdownClass" right></dropdown-tabblad>


        </div>
        `;
    }
}

customElements.define('table-nav', tablenav);