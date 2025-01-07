import { useEffect, useState } from "react";
import "./App.css";
import axios from "axios";

function App() {
  const [servers, setServers] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [adminPassword, setAdminPassword] = useState(null);
  const [selectedServer, setSelectedServer] = useState(null);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [showAddServerForm, setShowAddServerForm] = useState(false);
  const [showServerList, setShowServerList] = useState(true);
  const [currentAction, setCurrentAction] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [showAddUserForm, setShowAddUserForm] = useState(false);

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [newServer, setNewServer] = useState({
    ip: "",
    name: "",
    admin: "",
    port: "",
  });

  useEffect(() => {
    axios
      .get("http://localhost:3000/servers")
      .then((response) => setServers(response.data))
      .catch((error) =>
        console.error("Erreur lors de la récupération des serveurs", error)
      );
  }, []);

  const fetchUsers = (adminPassword) => {
    if (!adminPassword) {
      alert("Veuillez saisir le mot de passe.");
      return;
    }
    axios
      .post("http://localhost:3000/users", {
        ip: selectedServer.ip,
        username: selectedServer.username,
        password: adminPassword,
        port: selectedServer.port,
      })
      .then((response) => {
        const parsedUsers = response.data.users.map((line) => {
          const [username, password, uid, gid, gecos, home, shell] =
            line.split(":");
          return {
            username,
            uid,
            gid,
            home,
            shell,
          };
        });

        const groupMap = response.data.groups.reduce((acc, line) => {
          const [groupName, , groupId] = line.split(":");
          acc[groupId] = groupName; // Associer le GID au nom du groupe
          return acc;
        }, {});

        const usersWithGroupNames = parsedUsers.map((user) => ({
          ...user,
          groupName: groupMap[user.gid] || "Inconnu",
        }));

        const parsedGroups = response.data.groups.map((line) => {
          const [name, password, GID, users] = line.split(":");
          return { name, GID, users };
        });

        setUsers(usersWithGroupNames);
        setGroups(parsedGroups);
        setShowPasswordField(false);
      })
      .catch((error) =>
        console.error("Erreur lors de la récupération des utilisateurs", error)
      );
  };

  const addServer = () => {
    axios
      .post("http://localhost:3000/add-server", newServer)
      .then((response) => {
        setServers([...servers, response.data]);
        setNewServer({
          ip: "",
          name: "",
          admin: "",
          port: "",
        }).catch((error) =>
          console.error("Erreur lors de l'ajout du serveur", error)
        );
      });
  };

  const handleServerClick = (server) => {
    setSelectedServer(server);
    setShowPasswordField(true);
    setAdminPassword("");
    setShowServerList(false);
    setCurrentAction("fetchUsers");
  };

  const handleBackToList = () => {
    setSelectedServer(null);
    setShowServerList(true);
    setCurrentAction(null);
  };

  const handleConfirmDelete = (username) => {
    if (!username) {
      alert("Aucun utilisateur sélectionné.");
      return;
    }
    console.log(username);

    setUserToDelete(username);

    setShowPasswordField(true);
    setCurrentAction("deleteUser");
  };

  const handleDeleteUser = async () => {
    if (!adminPassword) {
      alert("Veuillez saisir le mot de passe.");
      return;
    }

    if (!selectedServer || !userToDelete) {
      alert("Aucun serveur ou utilisateur sélectionné.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:3000/delete-user", {
        ip: selectedServer.ip,
        username: selectedServer.username,
        password: adminPassword,
        port: selectedServer.port,
        userToDelete: userToDelete, // Utiliser userToDelete au lieu de username
      });

      if (response.data.success) {
        // Mettre à jour la liste des utilisateurs après suppression
        setUsers(users.filter((user) => user.username !== userToDelete));
        alert(`Utilisateur ${userToDelete} supprimé avec succès.`);
      }
    } catch (error) {
      console.error("Erreur lors de la suppression de l'utilisateur", error);
      alert("Erreur lors de la suppression de l'utilisateur.");
    } finally {
      setShowPasswordField(false); // Fermer la modal
      setCurrentAction(null); // Réinitialiser l'action en cours
      setUserToDelete(null); // Réinitialiser l'utilisateur à supprimer
    }
  };

  const handleConfirmAdd = () => {
    setShowPasswordField(true);
    setCurrentAction("addUser");
  };

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.confirmPassword) {
      alert("Veuillez remplir tous les champs.");
      return;
    }

    if (newUser.password !== newUser.confirmPassword) {
      alert("Les mots de passe ne correspondent pas.");
      return;
    }

    if (!adminPassword) {
      alert("Veuillez saisir le mot de passe administrateur.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:3000/add-user", {
        ip: selectedServer.ip,
        port: selectedServer.port,
        username: selectedServer.username,
        password: adminPassword,
        newUser: newUser.username,
        newPassword: newUser.password,
      });

      if (response.data.success) {
        alert(`Utilisateur ${newUser.username} ajouté avec succès.`);
        setShowAddUserForm(false);
        setNewUser({
          username: "",
          password: "",
          confirmPassword: "",
        });
        fetchUsers(adminPassword);
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout de l'utilisateur", error);
      alert("Erreur lors de l'ajout de l'utilisateur");
    }
  };

  const handleConfirmDeleteGroup = (GID) => {
    console.log(`Suppression du groupe avec le GID ${GID}`);
  };

  const handleEditUser = (username) => {
    console.log(`Modification de l'utilisateur ${username}`);
  };

  const handleEditGroup = (gid) => {
    console.log(`Modification du groupe possèdant le gid ${gid}`);
  };

  return (
    <div className="container">
      {showServerList && (
        <>
          <h2 className="title">Liste des serveurs</h2>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {servers.map((server) => (
              <div
                className="card text-center m-3 card-hover-effect"
                style={{
                  width: "25rem",
                  cursor: "pointer",
                  boxShadow: "3px 4px 5px 0px rgba(0,0,0,0.27)",
                }}
                key={server.ip}
                onClick={() => handleServerClick(server)}
              >
                <div className="card-body">
                  <h5 className="card-title">{server.name}</h5>
                </div>
                <p className="card-text mb-3">{server.ip}</p>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddServerForm(true)}
          >
            Ajouter un serveur
          </button>
        </>
      )}

      {selectedServer && (
        <div>
          <div style={{ position: "relative" }} className="mb-5">
            <button
              className="btn btn-secondary"
              style={{
                position: "relative",
                left: "",
                top: "45px",
                cursor: "pointer",
                zIndex: "100",
              }}
              onClick={handleBackToList}
            >
              Retour
            </button>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ position: "relative", margin: "auto" }}>
                Gestion du serveur {selectedServer.name}
              </h1>
            </div>
          </div>

          <div className="mb-5">
            <h2 className="title">Utilisateurs sur {selectedServer.name}</h2>

            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Nom d'utilisateur</th>
                  <th>Groupe</th>
                  <th>Shell</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.username}>
                    <td>{user.username}</td>
                    <td>{user.groupName}</td>
                    <td>{user.shell.split("/")[2]}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleConfirmDelete(user.username)}
                      >
                        Supprimer
                      </button>
                      <button
                        className="btn btn-warning btn-sm ms-2"
                        onClick={() => handleEditUser(user.username)}
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              className="btn btn-primary"
              onClick={() => {
                setShowAddUserForm(true);
              }}
            >
              Ajouter un utilisateur
            </button>
          </div>

          <div>
            <h2 className="title">Groupes sur {selectedServer.name}</h2>

            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Nom du groupe</th>
                  <th>GID</th>
                  <th>Utilisateurs</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.GID}>
                    <td>{group.name}</td>
                    <td>{group.GID}</td>
                    <td>{group.users}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleConfirmDeleteGroup(group.GID)}
                      >
                        Supprimer
                      </button>
                      <button
                        className="btn btn-warning btn-sm ms-2"
                        onClick={() => handleEditGroup(group.GID)}
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showAddUserForm && (
            <div className="form">
              <h3>Ajouter un utilisateur</h3>
              <div className="mb-3">
                <label htmlFor="inputUsername" className="form-label">
                  Nom d'utilisateur
                </label>
                <input
                  id="inputUsername"
                  type="text"
                  placeholder="Nom d'utilisateur"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                  className="form-control"
                />
              </div>
              <div className="mb-3">
                <label htmlFor="inputPassword" className="form-label">
                  Mot de passe
                </label>
                <input
                  id="inputPassword"
                  type="password"
                  placeholder="Mot de passe"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  className="form-control"
                />
              </div>
              <div className="mb-3">
                <label htmlFor="inputConfirmPassword" className="form-label">
                  Confirmer le mot de passe
                </label>
                <input
                  id="inputConfirmPassword"
                  type="password"
                  placeholder="Confirmer le mot de passe"
                  value={newUser.confirmPassword}
                  onChange={(e) =>
                    setNewUser({ ...newUser, confirmPassword: e.target.value })
                  }
                  className="form-control"
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "20px",
                }}
              >
                <button className="btn btn-primary" onClick={handleConfirmAdd}>
                  Ajouter
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAddUserForm(false)}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          <div
            className={`modal fade ${showPasswordField ? "show" : ""}`}
            style={{ display: showPasswordField ? "block" : "none" }}
            tabIndex="-1"
            role="dialog"
            aria-labelledby="passwordModalLabel"
            aria-hidden="true"
          >
            <div className="modal-dialog" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" id="passwordModalLabel">
                    Entrez le mot de passe administrateur
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={handleBackToList}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body">
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Mot de passe"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleBackToList}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      if (currentAction === "fetchUsers") {
                        fetchUsers(adminPassword);
                      } else if (currentAction === "deleteUser") {
                        handleDeleteUser();
                      } else if (currentAction === "addUser") {
                        handleAddUser(); // Appeler handleAddUser
                      }
                    }}
                  >
                    Valider
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div
            className={`modal-backdrop fade ${showPasswordField ? "show" : ""}`}
            style={{ display: showPasswordField ? "block" : "none" }}
          ></div>
        </div>
      )}

      {showAddServerForm && (
        <div className="form">
          <h3 className="title pb-3 mb-3" style={{ textAlign: "center" }}>
            Ajout d'un nouveau serveur
          </h3>
          <div className="mb-3">
            <label htmlFor="inputNameServer" className="form-label">
              Nom du serveur
            </label>
            <input
              id="inputNameServer"
              type="text"
              placeholder="Nom du serveur"
              value={newServer.name}
              onChange={(e) =>
                setNewServer({ ...newServer, name: e.target.value })
              }
              className="form-control"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="inputIpServer" className="form-label">
              Ip du serveur
            </label>
            <input
              id="inputIpServer"
              type="text"
              placeholder="IP du serveur"
              value={newServer.ip}
              onChange={(e) =>
                setNewServer({ ...newServer, ip: e.target.value })
              }
              className="form-control"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="inputNameAdmin" className="form-label">
              Nom de l'administrateur
            </label>
            <input
              type="text"
              placeholder="Nom de l'administrateur"
              value={newServer.admin}
              onChange={(e) =>
                setNewServer({ ...newServer, admin: e.target.value })
              }
              className="form-control"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="inputPort" className="form-label">
              Port SSH
            </label>
            <input
              id="inputPort"
              type="text"
              placeholder="Port SSH"
              value={newServer.port}
              onChange={(e) =>
                setNewServer({ ...newServer, port: e.target.value })
              }
              className="form-control"
            />
          </div>
          <div
            style={{ display: "flex", justifyContent: "center", gap: "20px" }}
          >
            <button className="btn btn-primary" onClick={addServer}>
              Ajouter
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setShowAddServerForm(false);
                setNewServer({
                  ip: "",
                  name: "",
                  admin: "",
                  port: "",
                });
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
