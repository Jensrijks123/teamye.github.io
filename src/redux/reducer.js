import {createReducer} from "@reduxjs/toolkit";
import  login  from '../redux/actions.login';

export default createReducer({login: false}, {
  [login.loggedIn]: (state, action) => ({...state, login: true}),
  [login.loggedOut]: (state, action) => ({...state, login: false})
});