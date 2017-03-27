#!/usr/bin/env node
const chalk = require('chalk');
const clear = require('clear');
const CLI = require('clui');
const figlet = require('figlet');
const inquirer = require('inquirer');
const Preferences = require('preferences');
const Spinner = CLI.Spinner;
const GithubApi = require('github');
const _ = require('lodash');
const git = require('simple-git')();
const touch = require('touch');
const fs = require ('fs');
const files = require('./lib/files.js');

clear();
console.log(
  chalk.yellow(
    figlet.textSync('Ginit',{ horizontalLayout: 'full' })
  )
);

if (files.directoryExists('.git')) {
  console.log(chalk.red('Already a git repository!'));
  process.exit();
}

function getGithubCredentials(callback) {
  var questions = [
    {
      name: 'username',
      type: 'input',
      message: 'Enter your Github username or email address: ',
      validate: (value) => {
        if (value.length) {
          return true;
        } else {
          return 'Please enter your username or email address';
        }
      }
    },
    {
      name:'password',
      type:'password',
      message: 'Enter your password',
      validate: (value) => {
        if (value.length) {
          return true;
        } else {
          return 'Please enter your password';
        }
      }
    }
  ];
  inquirer.prompt(questions).then(callback);
}

// getGithubCredentials( (args) => {
//   console.log(args);
// } );


const github = new GithubApi({
  version: '3.0.0'
});

function getGithubToken(callback) {
  let prefs = new Preferences('ginit');

  if (prefs.github && prefs.github.token) {
    return callback(null,prefs.github.token);
  }
}

  //Fetch token
  getGithubCredentials((credentials) => {
    const status = new Spinner('Authenticating you, please wait...');
    status.start();

    github.authenticate(
      _.extend(
        {
          type:'basic'
        },
        credentials
      )
    );

    github.authorization.create({
      scopes: ['user','public_repo','repo','repo:status'],
      note: 'ginit, the command-line tool for initializing Git repos'
    }, (err,res) => {
      status.stop();
        if (err) {
          return callback(err);
        }
        if (res.token) {
          prefs.github = {
            token: res.token
          };
          return callback(null, res.token);
        }
        return callback();
    });
  });

  function createRepo(callback) {
  const minimist = require ('minimist')(process.argv.slice(2));
  const questions = [
    {
      type:'input',
      name:'name',
      message:'Enter a name for the repository:',
        default: argv._[0] || files.getCurrentDirectoryBase(),
      validate: (value) => {
        if (value.length) {
          return true;
        } else {
          return 'Please Enter a name for the repository';
        }
      }
    },
    {
      type:'input',
      name:'description',
      default:argv._[1] || null,
      message:'Optioanally enter a description of the repository'
    },
    {
      type:'list',
      name:'visibility',
      message:'Public or private: ',
      choices:['public','private'],
      default:'public'
    }
  ];

  inquirer.prompt(questions).then( (answers) => {
    const status = new Spinner('Creating repository...');
    status.start();

    const data = {
      name: answers.name,
      description: answers.description,
      private: (answers.visibility === 'private')
    };

    github.repos.create(
      data,
      (err,res) => {
        status.stop();
        if (err) {
          return callback(err);
        }
        return callback(null,res.ssh_url);
      }
    );
  });
  }

  function createGitignore(callback) {
    const filelist = _.without(fs.readdirSync('.'),'.git','.gitignore');

    if (filelist.length) {
      inquirer.prompt(
        [
          {
            type:'checkbox',
            name:'ignore',
            message: 'Select the files and/or folders you wish to ignore:',
            choices: filelist,
            default:['node_modules','bower_components']
          }
        ]
      ).then((answers) => {
        if (answers.ignore.length) {
          fs.writeFileSync('.gitignore',answers.ignore.join('\n'));
        } else {
          touch('.gitignore');
        }
        return callback();
      });
    } else {
      touch('.gitignore');
      return callback();
    }
  }

  function setupRepo(url, callback) {
    const status = new Spinner('Setting up the repository...');
    status.start();

    git
    .init()
    .add('.gitignore')
    .add('./*')
    .commit('Initial commit')
    .addRemote('origin',url)
    .push('origin','master')
    .then( () => {
      status.stop();
      return callback();
    });
  }

  function githubAuth(callback) {
    getGithubToken( (err,token) => {
     if (err) {
       return callback(err);
     } 
     github.authenticate({
       type:'oauth',
       token:token
     });
     return callback(null,token);
    });
  }

  githubAuth( (err,authed) => {
    if (err) {
      switch (err.code) {
        case 401:
          console.log(chalk.red('Couldn\'t log you in. Please try again.'));
        break;
        case 422:
          console.log(chalk.red('You already have an access token'));
        break;
      }
    }
    if (authed) {
      console.log(chalk.green('Successfully authenticated!'));
      createRepo( (err,url) => {
        if (err) {
        console.log('An error has occured');
        }
        if (url) {
          createGitignore( () => {
            setupRepo(url, (err) => {
              if (!err) {
                console.log(chalk.green('All done!'));
              }
            });
          });
        }
      });
    }
  });
