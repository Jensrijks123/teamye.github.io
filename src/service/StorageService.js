export class StorageService {

    constructor() {
        this.localDB = window.localStorage;
        this.storage;
    }

    saveDatabase(data) {
        this.storage = data;
        this.localDB.setItem('storage', JSON.stringify(data));
    }

    getStorage(){
        return JSON.parse(this.localDB.getItem('storage'));
    }

    addExtraSheet(){
        console.log(this.storage);
        this.storage.push([]);
        this.localDB.setItem('storage', JSON.stringify(this.storage));
    }

}
