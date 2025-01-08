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
  const [editServer, setEditServer] = useState(null);
  const [editUser, setEditUser] = useState(null);

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [newServer, setNewServer] = useState({
    name: "",
    ip: "",
    admin: "",
    port: "",
  });
  const [updatedUser, setUpdatedUser] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = () => {
    axios
      .get("http://localhost:3000/servers")
      .then((response) => setServers(response.data))
      .catch((error) =>
        console.error("Erreur lors de la récupération des serveurs", error)
      );
  };

  const handleDeleteServer = (ip) => {
    axios.delete(`http://localhost:3000/delete-server/${ip}`).then(() => {
      fetchServers();
    });
  };

  const handleUpdateServer = (server) => {
    setEditServer(server);
    setNewServer(server);
  };

  const submitUpdateServer = () => {
    const { name, ip, username, port } = newServer;

    if (!name || !ip || !username || !port) {
      alert("Veuillez remplir tous les champs.");
      return;
    }

    axios
      .put(`http://localhost:3000/update-server/${editServer.ip}`, {
        name,
        username,
        port,
        newIp: ip,
      })
      .then(() => {
        fetchServers();
        setEditServer(null);
        setNewServer({
          name: "",
          ip: "",
          admin: "",
          port: "",
        });
      });
  };

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
        });
        setShowAddServerForm(false);
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
    setUsers([]);
    setGroups([]);
  };

  const handleConfirmDelete = (username) => {
    if (!username) {
      alert("Aucun utilisateur sélectionné.");
      return;
    }

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
        fetchUsers(adminPassword);
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

  const handleConfirmAddUser = () => {
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

  const handleUpdateUser = async () => {
    if (!updatedUser.username && !updatedUser.password) {
      alert("Veuillez remplir au moins un champ.");
      return;
    }

    if (updatedUser.password !== updatedUser.confirmPassword) {
      alert("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:3000/update-user", {
        ip: selectedServer.ip,
        port: selectedServer.port,
        username: selectedServer.username,
        password: adminPassword,
        userToUpdate: editUser.username,
        newUsername: updatedUser.username,
        newPassword: updatedUser.password,
      });

      if (response.data.success) {
        alert("Utilisateur modifié avec succès.");
        setEditUser(null);
        setUpdatedUser({ username: "", password: "", confirmPassword: "" });
        fetchUsers(adminPassword);
      }
    } catch (error) {
      console.error(
        "Erreur lors de la modification de l'utilisateur : ",
        error
      );
      alert("Erreur lors de la modification de l'utilisateur.");
    }
  };

  return (
    <div className="container">
      <h1 className="mt-5 mb-5 p-3 text-center border border-primary-subtle rounded">
        GESTION DES UTILISATEURS
      </h1>
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
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "20px",
                    marginBottom: "20px",
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateServer(server);
                    }}
                    className="btn btn-warning btn-sm"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteServer(server.ip);
                    }}
                    className="btn btn-danger btn-sm"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary mt-3"
            onClick={() => setShowAddServerForm(true)}
          >
            Ajouter un serveur
          </button>
        </>
      )}

      {editServer && (
        <div className="form">
          <h3 className="title pb-3 m-3" style={{ textAlign: "center" }}>
            Modification du serveur
          </h3>
          <div className="mb-3">
            <label htmlFor="inputServerName" className="form-label">
              Nom du serveur
            </label>
            <input
              id="inputServerName"
              type="text"
              value={newServer.name}
              onChange={(e) =>
                setNewServer({ ...newServer, name: e.target.value })
              }
              className="form-control"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="inputIP" className="form-label">
              IP du serveur
            </label>
            <input
              id="inputIP"
              type="text"
              value={newServer.ip}
              onChange={(e) =>
                setNewServer({ ...newServer, ip: e.target.value })
              }
              className="form-control"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="adminName" className="form-label">
              Nom de l'administrateur
            </label>
            <input
              id="adminName"
              type="text"
              value={newServer.username}
              onChange={(e) =>
                setNewServer({ ...newServer, username: e.target.value })
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
              value={newServer.port}
              onChange={(e) =>
                setNewServer({ ...newServer, port: e.target.value })
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
            <button onClick={submitUpdateServer} className="btn btn-primary">
              Enregistrer
            </button>
            <button
              onClick={() => {
                setEditServer(null);
                setNewServer({ name: "", ip: "", admin: "", port: "" });
              }}
              className="btn btn-secondary"
            >
              Annuler
            </button>
          </div>
        </div>
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
                        className="btn btn-warning btn-sm"
                        onClick={() => {
                          setEditUser(user);
                          setUpdatedUser({
                            username: user.username,
                            password: "",
                            confirmPassword: "",
                          });
                        }}
                      >
                        Modifier
                      </button>
                      <button
                        className="btn btn-danger btn-sm ms-2"
                        onClick={() => handleConfirmDelete(user.username)}
                      >
                        Supprimer
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

            {editUser && (
              <div className="form">
                <h3 className="title pb-3 mb-3" style={{ textAlign: "center" }}>
                  Modification de l'utilisateur {editUser.username}
                </h3>
                <div className="mb-3">
                  <label htmlFor="inputUsername" className="form-label">
                    Nouveau nom d'utilisateur
                  </label>
                  <input
                    id="inputUsername"
                    type="text"
                    placeholder="Nouveau nom d'utilisateur"
                    value={updatedUser.username}
                    onChange={(e) =>
                      setUpdatedUser({
                        ...updatedUser,
                        username: e.target.value,
                      })
                    }
                    className="form-control"
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="inputPassword" className="form-label">
                    Nouveau mot de passe
                  </label>
                  <input
                    id="inputPassword"
                    type="password"
                    placeholder="Nouveau mot de passe"
                    value={updatedUser.password}
                    onChange={(e) =>
                      setUpdatedUser({
                        ...updatedUser,
                        password: e.target.value,
                      })
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
                    value={updatedUser.confirmPassword}
                    onChange={(e) =>
                      setUpdatedUser({
                        ...updatedUser,
                        confirmPassword: e.target.value,
                      })
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
                  <button
                    className="btn btn-primary"
                    onClick={handleUpdateUser}
                  >
                    Enregistrer
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setEditUser(null)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          {showAddUserForm && (
            <div className="form mb-5">
              <h3 className="title pb-3 m-3" style={{ textAlign: "center" }}>
                Ajout d'un nouvel utilisateur
              </h3>
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
                <button
                  className="btn btn-primary"
                  onClick={handleConfirmAddUser}
                >
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

          <div>
            <h2 className="title">Groupes sur {selectedServer.name}</h2>

            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Nom du groupe</th>
                  <th>GID</th>
                  <th>Utilisateurs</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.GID}>
                    <td>{group.name}</td>
                    <td>{group.GID}</td>
                    <td>{group.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="modal-footer d-flex justify-content-center">
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
              placeholder="Ubuntu-server"
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
              placeholder="192.168.1.100"
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
              placeholder="admin"
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
              placeholder="22"
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
